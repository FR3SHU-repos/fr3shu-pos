import { newUuid } from "@/shared/lib/uuid";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { fromBaseQuantity } from "@/shared/lib/units";
import { readProducts } from "@/shared/lib/offline/products";
import type {
  OfflineOutboxEntry,
  OfflineReadiness,
  OfflineReferenceMappings,
  OfflineSalesExport,
  OfflineSaleInput,
  OfflineSaleRecord,
  OfflineSaleSyncOperation,
  OfflineScope,
} from "@/shared/lib/offline/sales-types";
export * from "@/shared/lib/offline/sales-types";
import {
  META_STORE,
  OUTBOX_STORE,
  SALE_STORE,
  assessOfflineStorage,
  notifyOfflineSalesChanged,
  offlineScopeIsActive,
  openOfflineDatabase,
  readOfflineReadiness,
  requestResult,
  storageError,
  txDone,
} from "@/shared/lib/offline/sales-storage";
export {
  readOfflineReadiness,
  readOfflineSessionContext,
  saveOfflineReadiness,
  saveOfflineSessionContext,
} from "@/shared/lib/offline/sales-storage";
import { offlineScopeKey } from "@/shared/lib/offline/sales-types";
import {
  buildOfflineSaleRecord,
  localStockDeductions,
} from "@/shared/lib/offline/sales-domain";
import { requeueOfflineSale } from "@/shared/lib/offline/sales-sync-state";
export {
  assessOfflineStorage,
  getOfflineDeviceId,
  lockOfflineScope,
  openOfflineDatabase,
  requestPersistentOfflineStorage,
  setOfflineActiveScope,
} from "@/shared/lib/offline/sales-storage";
export { offlineScopeKey } from "@/shared/lib/offline/sales-types";

export function rewriteOfflineSaleReferences(
  sale: OfflineSaleRecord,
  mappings: OfflineReferenceMappings,
): { sale: OfflineSaleRecord; changed: boolean } {
  let changed = false;
  const lines = sale.lines.map((line) => {
    const productId = mappings.productIds[line.productId] ?? line.productId;
    const lotEvidence = line.lotEvidence.map((lot) => {
      const lotId = mappings.lotIds[lot.lotId] ?? lot.lotId;
      if (lotId !== lot.lotId) changed = true;
      return lotId === lot.lotId ? lot : { ...lot, lotId };
    });
    if (productId !== line.productId) changed = true;
    return productId === line.productId && lotEvidence === line.lotEvidence
      ? line
      : { ...line, productId, lotEvidence };
  });
  return changed ? { sale: { ...sale, lines }, changed } : { sale, changed: false };
}

export async function applyOfflineMutationMappings(
  scope: OfflineScope,
  mappings: OfflineReferenceMappings,
): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const effectiveMappings: OfflineReferenceMappings = {
    productIds: { ...mappings.productIds },
    lotIds: { ...mappings.lotIds },
  };
  const snapshot = await readProducts();
  if (snapshot) {
    for (const sale of await listOfflineSales(scope)) {
      for (const line of sale.lines) {
        const productId = effectiveMappings.productIds[line.productId] ?? line.productId;
        const product = snapshot.items.find((item) => item._id === productId);
        if (!product) continue;
        for (const evidence of line.lotEvidence) {
          if (!evidence.lotId.startsWith("offline-lot-") || !evidence.lotCode) continue;
          const matchingLot = product.lots?.find((lot) => lot.lotCode === evidence.lotCode && !lot.lotId.startsWith("offline-lot-"));
          if (matchingLot?.lotId) effectiveMappings.lotIds[evidence.lotId] = matchingLot.lotId;
        }
      }
    }
  }
  if (Object.keys(effectiveMappings.productIds).length === 0 && Object.keys(effectiveMappings.lotIds).length === 0) return 0;
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction(SALE_STORE, "readwrite");
    const store = tx.objectStore(SALE_STORE);
    const sales = await requestResult<OfflineSaleRecord[]>(store.getAll());
    let updated = 0;
    for (const sale of sales) {
      if (offlineScopeKey(sale.scope) !== offlineScopeKey(scope)) continue;
      const rewritten = rewriteOfflineSaleReferences(sale, effectiveMappings);
      if (!rewritten.changed) continue;
      store.put(rewritten.sale);
      updated += 1;
    }
    await txDone(tx);
    if (updated > 0) notifyOfflineSalesChanged();
    return updated;
  } finally {
    db.close();
  }
}

async function validateOfflineWorkspace(input: OfflineSaleInput): Promise<OfflineReadiness | null> {
  if (!offlineScopeIsActive(input.scope)) throw new Error("This offline workspace is locked after account switching. Sign in again before using it.");
  const storage = await assessOfflineStorage();
  if (storage.status === "unsafe") throw new Error("Offline storage is too full. Free device storage before continuing.");
  return readOfflineReadiness(input.scope);
}


export {
  applyLocalStockDeductions,
  buildOfflineSaleRecord,
  localStockDeductions,
  parseRupeesToPaise,
  saleCanUseProducts,
  stockRecheckCandidate,
  validateCashPayment,
} from "@/shared/lib/offline/sales-domain";

export { applyOfflineSaleLineRepair } from "@/shared/lib/offline/sales-domain";
export { importOfflineSales } from "@/shared/lib/offline/sales-import";
export async function commitOfflineCashSale(input: OfflineSaleInput): Promise<OfflineSaleRecord> {
  if (typeof indexedDB === "undefined") throw new Error("Offline storage is not available in this browser.");
  const readiness = await validateOfflineWorkspace(input);
  const catalogue = await readProducts();
  input = {
    ...input,
    offlineGrantToken: input.offlineGrantToken ?? readiness?.grantToken,
    catalogueSnapshotVersion: catalogue?.snapshotVersion,
    catalogueEffectiveAt: catalogue?.effectiveAt,
    pricingPolicyVersion: catalogue?.pricingPolicyVersion,
    inventoryCursor: catalogue?.inventoryCursor,
  };
  const db = await openOfflineDatabase();
  try {
    const key = offlineScopeKey(input.scope);
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE, META_STORE], "readwrite");
    const metaStore = tx.objectStore(META_STORE);
    // Replays can happen when the browser crashes after IndexedDB commits but
    // before the UI receives the result. Treat the operation ID as an atomic
    // local idempotency key instead of creating a second receipt.
    const existing = await requestResult<OfflineSaleRecord | undefined>(
      tx.objectStore(SALE_STORE).get(input.operationId ?? ""),
    );
    if (existing) {
      await txDone(tx);
      return existing;
    }
    const existingSales = await requestResult<OfflineSaleRecord[]>(tx.objectStore(SALE_STORE).getAll());
    const deductions = localStockDeductions(
      existingSales.filter((sale) => offlineScopeKey(sale.scope) === key),
    );
    const current = (await requestResult<number | undefined>(metaStore.get(`${key}:receipt-sequence`))) ?? 0;
    const next = current + 1;
    const sale = buildOfflineSaleRecord(input, next, new Date(), deductions);
    const now = sale.createdAt;
    const outbox: OfflineOutboxEntry = {
      id: sale.operationId,
      saleId: sale.id,
      operationId: sale.operationId,
      scope: input.scope,
      kind: "sale.cash.v1",
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.objectStore(SALE_STORE).add(sale);
    tx.objectStore(OUTBOX_STORE).add(outbox);
    metaStore.put(next, `${key}:receipt-sequence`);
    await txDone(tx);
    notifyOfflineSalesChanged();
    return sale;
  } catch (error) {
    throw storageError(error);
  } finally {
    db.close();
  }
}

export async function listPendingOfflineSales(scope: OfflineScope): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readonly");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const [allSales, allOutbox] = await Promise.all([
      requestResult<OfflineSaleRecord[]>(saleStore.getAll()),
      requestResult<OfflineOutboxEntry[]>(outboxStore.getAll()),
    ]);
    await txDone(tx);
    db.close();
    const key = offlineScopeKey(scope);
    const now = Date.now();
    const syncableOperationIds = new Set(
      allOutbox
        .filter((entry) => offlineScopeKey(entry.scope) === key)
        .filter((entry) => entry.status !== "blocked" && entry.status !== "needs_review")
        .filter((entry) => new Date(entry.nextAttemptAt).getTime() <= now)
        .map((entry) => entry.operationId),
    );
    return allSales
      .filter((sale) => offlineScopeKey(sale.scope) === key)
      .filter((sale) => sale.syncState !== "synced" && sale.syncState !== "blocked" && sale.syncState !== "cancelled" && sale.syncState !== "needs_review")
      .filter((sale) => syncableOperationIds.has(sale.operationId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/** Claim a bounded batch so two tabs cannot upload the same local records. */
export async function claimPendingOfflineSales(
  scope: OfflineScope,
  limit = 10,
  leaseMs = 30_000,
  nowMs = Date.now(),
): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const [sales, outboxes] = await Promise.all([
      requestResult<OfflineSaleRecord[]>(saleStore.getAll()),
      requestResult<OfflineOutboxEntry[]>(outboxStore.getAll()),
    ]);
    const key = offlineScopeKey(scope);
    const now = new Date(nowMs).toISOString();
    const expires = new Date(nowMs + leaseMs).toISOString();
    const salesById = new Map(sales.map((sale) => [sale.operationId, sale]));
    const claimed: OfflineSaleRecord[] = [];
    for (const entry of outboxes
      .filter((item) => offlineScopeKey(item.scope) === key)
      .filter((item) => item.status !== "blocked" && item.status !== "needs_review" && item.status !== "cancelled")
      .filter((item) => new Date(item.nextAttemptAt).getTime() <= nowMs)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (claimed.length >= limit) break;
      const leaseActive = entry.status === "uploading" && entry.leaseExpiresAt && new Date(entry.leaseExpiresAt).getTime() > nowMs;
      if (leaseActive) continue;
      const sale = salesById.get(entry.operationId);
      if (!sale || sale.syncState === "synced" || sale.syncState === "cancelled") continue;
      const leaseId = newUuid();
      entry.status = "uploading";
      entry.leaseId = leaseId;
      entry.leaseExpiresAt = expires;
      entry.updatedAt = now;
      outboxStore.put(entry);
      sale.syncState = "uploading";
      sale.syncAttempts = entry.attempts + 1;
      sale.lastSyncAttemptAt = now;
      saleStore.put(sale);
      claimed.push(sale);
    }
    await txDone(tx);
    return claimed;
  } finally {
    db.close();
  }
}

export async function listOfflineSales(scope: OfflineScope): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(SALE_STORE, "readonly");
    const all = await requestResult<OfflineSaleRecord[]>(tx.objectStore(SALE_STORE).getAll());
    await txDone(tx);
    db.close();
    const key = offlineScopeKey(scope);
    return all
      .filter((sale) => offlineScopeKey(sale.scope) === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/** Bring transient failures forward when the operator explicitly retries or connectivity returns. */
export async function requeueRetryableOfflineSales(scope: OfflineScope): Promise<number> {
  const sales = await listOfflineSales(scope);
  let queued = 0;
  for (const sale of sales) {
    if (sale.syncState !== "retry_wait") continue;
    if (await requeueOfflineSale(scope, sale.operationId)) queued += 1;
  }
  return queued;
}


export async function exportOfflineSales(scope: OfflineScope): Promise<OfflineSalesExport> {
  return {
    exportedAt: new Date().toISOString(),
    scope,
    sales: await listOfflineSales(scope),
  };
}

export { markOfflineSaleSyncState } from "@/shared/lib/offline/sales-sync-state";

export {
  repairOfflineSaleLines,
  updateOfflineSaleCustomer,
} from "@/shared/lib/offline/sales-sync-state";

export {
  cancelOfflineSale,
  cleanupOfflineSales,
} from "@/shared/lib/offline/sales-sync-state";

export { requeueBlockedOfflineSalesWithAvailableStock } from "@/shared/lib/offline/sales-sync-state";

export {
  incrementOfflineSaleAttempt,
  requeueOfflineSale,
} from "@/shared/lib/offline/sales-sync-state";

export function offlineSaleToSyncOperation(sale: OfflineSaleRecord): OfflineSaleSyncOperation {
  return {
    operationId: sale.operationId,
    offlineGrantToken: sale.offlineGrantToken,
    registerId: sale.registerId,
    sessionId: sale.sessionId,
    deviceReceiptNo: sale.receiptNo,
    occurredAt: sale.soldAt,
    catalogueSnapshotVersion: sale.catalogueSnapshotVersion,
    catalogueEffectiveAt: sale.catalogueEffectiveAt,
    pricingPolicyVersion: sale.pricingPolicyVersion,
    inventoryCursor: sale.inventoryCursor ?? "0",
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    buyerCode: sale.buyerCode,
    marketingConsent: sale.marketingConsent,
    lines: sale.lines.map((line) => ({
      skuId: line.productId,
      qty: String(fromBaseQuantity(line.qtyBase, line.saleUnit as Parameters<typeof fromBaseQuantity>[1], line.basePerSaleUnit)),
      unit: line.saleUnit,
      baseUnit: line.baseUnit,
      basePerSaleUnit: line.basePerSaleUnit,
      unitPriceMinor: line.unitPricePaise,
      priceOverridden: line.priceOverridden,
      grossMinor: line.grossPaise,
      discountMinor: line.discountPaise,
      taxRateBps: line.taxRateBps,
      taxMinor: line.taxPaise,
      netMinor: line.netPaise,
      lotEvidence: (line.lotEvidence ?? []).map((lot) => ({
        lotId: lot.lotId,
        lotCode: lot.lotCode,
        quantity: String(lot.qtyBase),
        expiresAt: lot.expiresAt,
      })),
    })),
    cashReceivedMinor: sale.payment.receivedPaise,
    cashAppliedMinor: sale.payment.amountPaise,
    changeMinor: sale.payment.changePaise,
    totalMinor: sale.totalPaise,
    subtotalMinor: sale.grossPaise,
    discountMinor: sale.discountPaise,
    taxMinor: sale.taxPaise,
  };
}

export function offlineSaleToDTO(sale: OfflineSaleRecord): SaleDTO {
  return {
    _id: sale.id,
    receiptNo: sale.serverReceiptNo ?? sale.receiptNo,
    status: sale.status,
    items: sale.lines.map((line) => ({
      productId: line.productId,
      lotId: "",
      name: line.name,
      sku: line.sku,
      barcode: line.barcode,
      saleUnit: line.saleUnit as SaleDTO["items"][number]["saleUnit"],
      baseUnit: line.baseUnit,
      qtyBase: line.qtyBase,
      basePerSaleUnit: line.basePerSaleUnit,
      unitPricePaise: line.unitPricePaise,
      grossPaise: line.grossPaise,
      discountPaise: line.discountPaise,
      taxRateBps: line.taxRateBps,
      taxPaise: line.taxPaise,
      netPaise: line.netPaise,
    })),
    grossPaise: sale.grossPaise,
    discountPaise: sale.discountPaise,
    taxPaise: sale.taxPaise,
    totalPaise: sale.totalPaise,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    cashierId: sale.cashierId,
    registerId: sale.registerId,
    sessionId: sale.sessionId,
    locationId: sale.scope.locationId,
    soldAt: sale.soldAt,
    syncState: sale.syncState === "synced" ? "synced" : "pending",
    idempotencyKey: sale.operationId,
    paymentState: "captured",
  };
}
