import type { ProductDTO } from "@/shared/lib/api/products";
import {
  applyOfflineSaleLineRepair,
  localStockDeductions,
  saleCanUseProducts,
  stockRecheckCandidate,
} from "@/shared/lib/offline/sales-domain";
import {
  OUTBOX_STORE,
  SALE_STORE,
  notifyOfflineSalesChanged,
  openOfflineDatabase,
  requestResult,
  txDone,
} from "@/shared/lib/offline/sales-storage";
import {
  offlineScopeKey,
  type OfflineOutboxEntry,
  type OfflineSaleCustomerPatch,
  type OfflineSaleRecord,
  type OfflineSaleSyncDiagnostic,
  type OfflineSaleSyncState,
  type OfflineScope,
} from "@/shared/lib/offline/sales-types";

export async function markOfflineSaleSyncState(
  scope: OfflineScope,
  operationId: string,
  syncState: OfflineSaleSyncState,
  detail?: {
    message?: string;
    failureStage?: string;
    failureCode?: string;
    failureDetail?: string;
    requestId?: string;
    traceId?: string;
    reviewId?: string;
    serverSaleId?: string;
    serverReceiptNo?: string;
    inventoryCoveredAt?: string;
    serverInventoryCursor?: string;
  },
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (!sale || offlineScopeKey(sale.scope) !== offlineScopeKey(scope)) {
      tx.abort();
      db.close();
      return false;
    }
    sale.syncState = syncState;
    sale.syncMessage = detail?.message;
    sale.syncFailureStage = detail?.failureStage ?? sale.syncFailureStage;
    sale.syncFailureCode = detail?.failureCode ?? sale.syncFailureCode;
    sale.syncFailureDetail = detail?.failureDetail ?? sale.syncFailureDetail;
    sale.syncRequestId = detail?.requestId ?? sale.syncRequestId;
    sale.syncTraceId = detail?.traceId ?? sale.syncTraceId;
    sale.syncReviewId = detail?.reviewId ?? sale.syncReviewId;
    sale.serverSaleId = detail?.serverSaleId ?? sale.serverSaleId;
    sale.serverReceiptNo = detail?.serverReceiptNo ?? sale.serverReceiptNo;
    sale.inventoryCoveredAt = detail?.inventoryCoveredAt ?? sale.inventoryCoveredAt;
    sale.serverInventoryCursor = detail?.serverInventoryCursor ?? sale.serverInventoryCursor;
    sale.lastSyncAttemptAt = new Date().toISOString();
    saleStore.put(sale);
    if (syncState === "synced") {
      outboxStore.delete(operationId);
    } else {
      const outbox = await requestResult<OfflineOutboxEntry | undefined>(
        outboxStore.get(operationId),
      );
      if (outbox) {
        outbox.status =
          syncState === "auth_required"
            ? "auth_required"
            : syncState === "blocked" || syncState === "cancelled" || syncState === "needs_review"
              ? syncState
              : "retry_wait";
        outbox.leaseId = undefined;
        outbox.leaseExpiresAt = undefined;
        outbox.attempts += 1;
        outbox.updatedAt = new Date().toISOString();
        outbox.nextAttemptAt = new Date(Date.now() + 60_000).toISOString();
        outboxStore.put(outbox);
      }
    }
    await txDone(tx);
    db.close();
    notifyOfflineSalesChanged();
    return true;
  } catch {
    return false;
  }
}

function normalizeOfflinePhone(value?: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!national) throw new Error("Customer mobile number is required.");
  if (!/^[6-9][0-9]{9}$/.test(national)) throw new Error("Enter a valid Indian mobile number.");
  return national;
}

export async function repairOfflineSaleLines(
  scope: OfflineScope,
  operationId: string,
  changes: Array<{ productId: string; qty?: number; remove?: boolean }>,
): Promise<OfflineSaleRecord> {
  if (typeof indexedDB === "undefined") throw new Error("Offline sale storage is not available.");
  if (changes.length === 0) throw new Error("Choose at least one line to repair.");
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (!sale || offlineScopeKey(sale.scope) !== offlineScopeKey(scope)) {
      tx.abort();
      throw new Error("Offline sale was not found on this device.");
    }
    if (sale.syncState === "synced") {
      tx.abort();
      throw new Error("This sale is already synced.");
    }
    const repaired = applyOfflineSaleLineRepair(sale, changes);
    const now = new Date().toISOString();
    repaired.syncState = "pending";
    repaired.syncMessage = "Sale items updated. Queued for another automatic sync check.";
    repaired.lastSyncAttemptAt = now;
    saleStore.put(repaired);
    const existing = await requestResult<OfflineOutboxEntry | undefined>(
      outboxStore.get(operationId),
    );
    outboxStore.put({
      id: operationId,
      saleId: repaired.id,
      operationId,
      scope: repaired.scope,
      kind: "sale.cash.v1",
      status: "pending",
      attempts: existing?.attempts ?? 0,
      nextAttemptAt: now,
      createdAt: existing?.createdAt ?? repaired.createdAt,
      updatedAt: now,
    });
    await txDone(tx);
    notifyOfflineSalesChanged();
    return repaired;
  } finally {
    db.close();
  }
}

export async function updateOfflineSaleCustomer(
  scope: OfflineScope,
  operationId: string,
  patch: OfflineSaleCustomerPatch,
): Promise<OfflineSaleRecord> {
  if (typeof indexedDB === "undefined") throw new Error("Offline sale storage is not available.");
  const customerName = patch.customerName.trim();
  if (!customerName) throw new Error("Customer name is required.");
  const customerPhone = normalizeOfflinePhone(patch.customerPhone);
  const buyerCode = patch.buyerCode?.trim().toUpperCase();
  if (buyerCode && !/^BYR-[A-F0-9]{10}$/.test(buyerCode))
    throw new Error("Enter a valid buyer code.");
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (!sale || offlineScopeKey(sale.scope) !== offlineScopeKey(scope)) {
      tx.abort();
      throw new Error("Offline sale was not found on this device.");
    }
    if (sale.syncState === "synced") {
      tx.abort();
      throw new Error("This sale is already synced.");
    }
    const now = new Date().toISOString();
    sale.customerName = customerName;
    sale.customerPhone = customerPhone;
    sale.buyerCode = buyerCode || undefined;
    sale.marketingConsent = patch.marketingConsent ?? sale.marketingConsent;
    sale.syncState = "pending";
    sale.syncMessage = "Customer details updated. Queued for another automatic sync check.";
    sale.lastSyncAttemptAt = now;
    saleStore.put(sale);
    const existing = await requestResult<OfflineOutboxEntry | undefined>(
      outboxStore.get(operationId),
    );
    outboxStore.put({
      id: operationId,
      saleId: sale.id,
      operationId,
      scope: sale.scope,
      kind: "sale.cash.v1",
      status: "pending",
      attempts: existing?.attempts ?? 0,
      nextAttemptAt: now,
      createdAt: existing?.createdAt ?? sale.createdAt,
      updatedAt: now,
    });
    await txDone(tx);
    notifyOfflineSalesChanged();
    return sale;
  } finally {
    db.close();
  }
}

export async function cancelOfflineSale(
  scope: OfflineScope,
  operationId: string,
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (
      !sale ||
      offlineScopeKey(sale.scope) !== offlineScopeKey(scope) ||
      sale.syncState === "synced"
    ) {
      tx.abort();
      db.close();
      return false;
    }
    sale.syncState = "cancelled";
    sale.syncMessage = "Cancelled locally. This sale will not sync to the database.";
    sale.lastSyncAttemptAt = new Date().toISOString();
    saleStore.put(sale);
    outboxStore.delete(operationId);
    await txDone(tx);
    db.close();
    notifyOfflineSalesChanged();
    return true;
  } catch {
    return false;
  }
}

export async function cleanupOfflineSales(
  scope: OfflineScope,
  olderThanMs = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const all = await requestResult<OfflineSaleRecord[]>(saleStore.getAll());
    const key = offlineScopeKey(scope);
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;
    for (const sale of all) {
      const terminal = sale.syncState === "synced" || sale.syncState === "cancelled";
      const saleTime = new Date(sale.lastSyncAttemptAt ?? sale.createdAt).getTime();
      if (offlineScopeKey(sale.scope) === key && terminal && saleTime < cutoff) {
        saleStore.delete(sale.id);
        outboxStore.delete(sale.operationId);
        removed += 1;
      }
    }
    await txDone(tx);
    db.close();
    if (removed > 0) notifyOfflineSalesChanged();
    return removed;
  } catch {
    return 0;
  }
}

export async function requeueBlockedOfflineSalesWithAvailableStock(
  scope: OfflineScope,
  products: ProductDTO[],
  snapshotSavedAt: number,
): Promise<number> {
  if (typeof indexedDB === "undefined" || products.length === 0) return 0;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const all = await requestResult<OfflineSaleRecord[]>(saleStore.getAll());
    const key = offlineScopeKey(scope);
    const scopedSales = all.filter((sale) => offlineScopeKey(sale.scope) === key);
    const now = new Date().toISOString();
    let queued = 0;
    for (const sale of scopedSales) {
      if (!stockRecheckCandidate(sale)) continue;
      const otherDeductions = localStockDeductions(
        scopedSales.filter((other) => other.operationId !== sale.operationId),
        snapshotSavedAt,
      );
      const check = saleCanUseProducts(sale, products, otherDeductions);
      if (!check.ok) {
        sale.syncMessage = check.reason;
        sale.lastSyncAttemptAt = now;
        saleStore.put(sale);
        continue;
      }
      sale.syncState = "pending";
      sale.syncMessage = "Refreshed stock is available. Queued for another automatic sync check.";
      sale.lastSyncAttemptAt = now;
      saleStore.put(sale);
      const existing = await requestResult<OfflineOutboxEntry | undefined>(
        outboxStore.get(sale.operationId),
      );
      outboxStore.put({
        id: sale.operationId,
        saleId: sale.id,
        operationId: sale.operationId,
        scope: sale.scope,
        kind: "sale.cash.v1",
        status: "pending",
        attempts: existing?.attempts ?? 0,
        nextAttemptAt: now,
        createdAt: existing?.createdAt ?? sale.createdAt,
        updatedAt: now,
      });
      queued += 1;
    }
    await txDone(tx);
    db.close();
    if (queued > 0) notifyOfflineSalesChanged();
    return queued;
  } catch {
    return 0;
  }
}

export async function requeueOfflineSale(
  scope: OfflineScope,
  operationId: string,
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (
      !sale ||
      offlineScopeKey(sale.scope) !== offlineScopeKey(scope) ||
      sale.syncState === "synced"
    ) {
      tx.abort();
      db.close();
      return false;
    }
    const now = new Date().toISOString();
    sale.syncState = "pending";
    sale.syncMessage = "Queued for another automatic sync check.";
    sale.lastSyncAttemptAt = now;
    saleStore.put(sale);
    const existing = await requestResult<OfflineOutboxEntry | undefined>(
      outboxStore.get(operationId),
    );
    outboxStore.put({
      id: operationId,
      saleId: sale.id,
      operationId,
      scope: sale.scope,
      kind: "sale.cash.v1",
      status: "pending",
      attempts: existing?.attempts ?? 0,
      nextAttemptAt: now,
      createdAt: existing?.createdAt ?? sale.createdAt,
      updatedAt: now,
    });
    await txDone(tx);
    db.close();
    notifyOfflineSalesChanged();
    return true;
  } catch {
    return false;
  }
}

export async function incrementOfflineSaleAttempt(
  scope: OfflineScope,
  operationId: string,
  retryInMs: number,
  message?: string,
  diagnostic?: OfflineSaleSyncDiagnostic,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const store = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (sale && offlineScopeKey(sale.scope) === offlineScopeKey(scope)) {
      sale.syncState = "retry_wait";
      sale.syncMessage = message ?? sale.syncMessage;
      sale.syncFailureStage = diagnostic?.failureStage ?? sale.syncFailureStage;
      sale.syncFailureCode = diagnostic?.failureCode ?? sale.syncFailureCode;
      sale.syncFailureDetail = diagnostic?.failureDetail ?? sale.syncFailureDetail;
      sale.syncRequestId = diagnostic?.requestId ?? sale.syncRequestId;
      sale.syncTraceId = diagnostic?.traceId ?? sale.syncTraceId;
      sale.lastSyncAttemptAt = new Date().toISOString();
      saleStore.put(sale);
    }
    const outbox = await requestResult<OfflineOutboxEntry | undefined>(store.get(operationId));
    if (outbox && offlineScopeKey(outbox.scope) === offlineScopeKey(scope)) {
      outbox.status = "retry_wait";
      outbox.attempts += 1;
      outbox.leaseId = undefined;
      outbox.leaseExpiresAt = undefined;
      outbox.updatedAt = new Date().toISOString();
      outbox.nextAttemptAt = new Date(Date.now() + retryInMs).toISOString();
      store.put(outbox);
      if (sale) {
        sale.syncAttempts = outbox.attempts;
        saleStore.put(sale);
      }
    }
    await txDone(tx);
    db.close();
    notifyOfflineSalesChanged();
  } catch {
    /* best effort bookkeeping */
  }
}
