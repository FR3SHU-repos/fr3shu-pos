import type { ProductDTO } from "@/shared/lib/api/products";
import type { SaleDTO } from "@/shared/lib/api/sales";
import type { SessionDTO } from "@/shared/lib/api/registers";
import { newUuid } from "@/shared/lib/uuid";
import type { CartLine } from "@/shared/components/pos/types";
import { computeLineTotals, sumCartTotals } from "@/shared/lib/money";
import { fromBaseQuantity, toBaseQuantity } from "@/shared/lib/units";
import { OFFLINE_PRICING_POLICY_VERSION, readProducts } from "@/shared/lib/offline/products";

export type OfflineSaleSyncState = "pending" | "uploading" | "retry_wait" | "synced" | "blocked" | "cancelled" | "needs_review" | "auth_required";

export interface OfflineScope {
  userId: string;
  orgId: string;
  locationId: string;
}

export type OfflineStorageStatus = "ready" | "unsafe" | "unknown";

export interface OfflineStorageReadiness {
  status: OfflineStorageStatus;
  persisted: boolean;
  availableBytes?: number;
  checkedAt: number;
}

export interface OfflineReadiness {
  deviceId: string;
  grantId: string;
  grantToken: string;
  registerId: string;
  terminalId: string;
  shiftId: string;
  issuedAt: string;
  expiresAt: string;
  preparedAt: number;
  storage: OfflineStorageReadiness;
}

export interface OfflineCashPayment {
  method: "cash";
  amountPaise: number;
  receivedPaise: number;
  changePaise: number;
}

export interface OfflineLotEvidence {
  lotId: string;
  lotCode?: string;
  qtyBase: number;
  expiresAt?: string;
}

export interface OfflineSaleLine {
  productId: string;
  productSlug?: string;
  sku: string;
  barcode?: string;
  name: string;
  saleUnit: string;
  qty: number;
  qtyBase: number;
  basePerSaleUnit: number;
  unitPricePaise: number;
  grossPaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxRateBps: number;
  taxPaise: number;
  netPaise: number;
  lotEvidence: OfflineLotEvidence[];
}

export interface OfflineSaleRecord {
  id: string;
  operationId: string;
  scope: OfflineScope;
  registerId: string;
  sessionId: string;
  receiptNo: string;
  receiptSequence: number;
  status: "completed";
  syncState: OfflineSaleSyncState;
  syncMessage?: string;
  syncFailureStage?: string;
  syncFailureCode?: string;
  syncFailureDetail?: string;
  syncRequestId?: string;
  syncTraceId?: string;
  serverSaleId?: string;
  serverReceiptNo?: string;
  /** Set only after a successful post-ack catalogue refresh. */
  inventoryCoveredAt?: string;
  inventoryCursor?: string;
  serverInventoryCursor?: string;
  lastSyncAttemptAt?: string;
  syncAttempts?: number;
  offlineGrantToken?: string;
  catalogueSnapshotVersion: string;
  catalogueEffectiveAt: string;
  pricingPolicyVersion: string;
  lines: OfflineSaleLine[];
  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  payment: OfflineCashPayment;
  customerName: string;
  customerPhone?: string;
  buyerCode?: string;
  marketingConsent: boolean;
  cashierId: string;
  soldAt: string;
  createdAt: string;
  schemaVersion: 1 | 2;
}

export interface OfflineOutboxEntry {
  id: string;
  saleId: string;
  operationId: string;
  scope: OfflineScope;
  kind: "sale.cash.v1";
  status: Exclude<OfflineSaleSyncState, "synced">;
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  leaseId?: string;
  leaseExpiresAt?: string;
}

export interface OfflineSaleSyncOperation {
  operationId: string;
  offlineGrantToken?: string;
  registerId: string;
  sessionId: string;
  deviceReceiptNo: string;
  occurredAt: string;
  catalogueSnapshotVersion?: string;
  catalogueEffectiveAt?: string;
  pricingPolicyVersion?: string;
  inventoryCursor?: string;
  customerName: string;
  customerPhone?: string;
  buyerCode?: string;
  marketingConsent: boolean;
  lines: Array<{
    skuId: string;
    qty: string;
    unit: string;
    unitPriceMinor: number;
    grossMinor: number;
    discountMinor: number;
    taxRateBps: number;
    taxMinor: number;
    netMinor: number;
    lotEvidence: Array<{
      lotId: string;
      lotCode?: string;
      quantity: string;
      expiresAt?: string;
    }>;
  }>;
  cashReceivedMinor: number;
  cashAppliedMinor: number;
  changeMinor: number;
  totalMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
}

export interface OfflineReferenceMappings {
  productIds: Record<string, string>;
  lotIds: Record<string, string>;
}

export interface OfflineSaleInput {
  scope: OfflineScope;
  session: SessionDTO;
  cashierId: string;
  lines: CartLine[];
  cashReceivedPaise: number;
  customerName: string;
  customerPhone?: string;
  buyerCode?: string;
  marketingConsent?: boolean;
  operationId?: string;
  offlineGrantToken?: string;
  catalogueSnapshotVersion?: string;
  catalogueEffectiveAt?: string;
  pricingPolicyVersion?: string;
  inventoryCursor?: string;
}

export type LocalStockDeductions = Record<string, number>;

const DB_NAME = "komola-offline-pos-v1";
const DB_VERSION = 3;
const SALE_STORE = "sales";
const OUTBOX_STORE = "outbox";
const CONTEXT_STORE = "contexts";
const META_STORE = "meta";
const HELD_CART_STORE = "heldCarts";
const READINESS_STORE = "readiness";
const OFFLINE_DEVICE_ID_KEY = "offline-device-id";
const ACTIVE_SCOPE_KEY = "komola:offline-active-scope";
const MIN_OFFLINE_HEADROOM_BYTES = 10 * 1024 * 1024;

function notifyOfflineSalesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("komola:offline-sales-changed"));
}

export function offlineScopeKey(scope: OfflineScope): string {
  return JSON.stringify([scope.userId, scope.orgId, scope.locationId]);
}

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

function sessionStorageSafe(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Selects the current authenticated scope for browser-side offline reads. */
export function setOfflineActiveScope(scope: OfflineScope | null): void {
  const storage = sessionStorageSafe();
  if (!storage) return;
  if (!scope) storage.removeItem(ACTIVE_SCOPE_KEY);
  else storage.setItem(ACTIVE_SCOPE_KEY, offlineScopeKey(scope));
}

export function lockOfflineScope(scope: OfflineScope): void {
  const storage = sessionStorageSafe();
  if (!storage) return;
  if (storage.getItem(ACTIVE_SCOPE_KEY) === offlineScopeKey(scope)) storage.removeItem(ACTIVE_SCOPE_KEY);
}

function offlineScopeIsActive(scope: OfflineScope): boolean {
  if (process.env.NODE_ENV === "test" || typeof window === "undefined") return true;
  return sessionStorageSafe()?.getItem(ACTIVE_SCOPE_KEY) === offlineScopeKey(scope);
}

export async function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SALE_STORE)) db.createObjectStore(SALE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CONTEXT_STORE)) db.createObjectStore(CONTEXT_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(HELD_CART_STORE)) db.createObjectStore(HELD_CART_STORE);
      if (!db.objectStoreNames.contains(READINESS_STORE)) db.createObjectStore(READINESS_STORE);
    };
    request.onblocked = () => reject(new Error("Offline storage is waiting for another KOMOLA tab to close before it can update. Close older tabs and try again."));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Offline storage could not be opened."));
  });
}

export async function getOfflineDeviceId(): Promise<string> {
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    const existing = await requestResult<string | undefined>(store.get(OFFLINE_DEVICE_ID_KEY));
    if (existing) {
      await txDone(tx);
      return existing;
    }
    const generated = globalThis.crypto?.randomUUID?.() ?? newUuid();
    store.put(generated, OFFLINE_DEVICE_ID_KEY);
    await txDone(tx);
    return generated;
  } finally {
    db.close();
  }
}

export async function assessOfflineStorage(): Promise<OfflineStorageReadiness> {
  const checkedAt = Date.now();
  if (typeof indexedDB === "undefined") return { status: "unsafe", persisted: false, checkedAt };
  let persisted = false;
  let availableBytes: number | undefined;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persisted) persisted = await navigator.storage.persisted();
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.quota === "number" && typeof estimate.usage === "number") availableBytes = Math.max(0, estimate.quota - estimate.usage);
    }
  } catch {
    return { status: "unknown", persisted, checkedAt };
  }
  if (availableBytes !== undefined && availableBytes < MIN_OFFLINE_HEADROOM_BYTES) return { status: "unsafe", persisted, availableBytes, checkedAt };
  return { status: availableBytes === undefined ? "unknown" : "ready", persisted, availableBytes, checkedAt };
}

export async function requestPersistentOfflineStorage(): Promise<OfflineStorageReadiness> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Persistence is a browser policy decision; the quota check below remains authoritative.
  }
  return assessOfflineStorage();
}

export async function saveOfflineReadiness(scope: OfflineScope, readiness: OfflineReadiness): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(READINESS_STORE, "readwrite");
    tx.objectStore(READINESS_STORE).put(readiness, `${offlineScopeKey(scope)}:readiness`);
    await txDone(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function readOfflineReadiness(scope: OfflineScope): Promise<OfflineReadiness | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(READINESS_STORE, "readonly");
    const readiness = await requestResult<OfflineReadiness | undefined>(tx.objectStore(READINESS_STORE).get(`${offlineScopeKey(scope)}:readiness`));
    await txDone(tx);
    db.close();
    return readiness ?? null;
  } catch {
    return null;
  }
}

async function validateOfflineWorkspace(input: OfflineSaleInput): Promise<OfflineReadiness | null> {
  if (!offlineScopeIsActive(input.scope)) throw new Error("This offline workspace is locked after account switching. Sign in again before using it.");
  const storage = await assessOfflineStorage();
  if (storage.status === "unsafe") throw new Error("Offline storage is too full. Free device storage before continuing.");
  return readOfflineReadiness(input.scope);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

function storageError(error: unknown): Error | unknown {
  const name = error instanceof DOMException ? error.name : error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name) : "";
  if (["QuotaExceededError", "InvalidStateError", "AbortError", "VersionError"].includes(name)) {
    if (name === "QuotaExceededError") return new Error("Offline storage is full. Export a backup or free device storage before continuing.");
    if (name === "VersionError") return new Error("Offline storage needs another KOMOLA tab to close before it can be upgraded. Close older tabs and try again.");
    return new Error("Offline storage could not complete this operation. Keep the local receipt and try again.");
  }
  return error;
}

export function parseRupeesToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [rupees, paise = ""] = trimmed.split(".");
  return Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
}

export function validateCashPayment(totalPaise: number, receivedPaise: number): OfflineCashPayment {
  if (!Number.isInteger(receivedPaise) || receivedPaise < 0) {
    throw new Error("Enter a valid cash amount.");
  }
  if (receivedPaise < totalPaise) {
    throw new Error("Cash received is less than the sale total.");
  }
  return {
    method: "cash",
    amountPaise: totalPaise,
    receivedPaise,
    changePaise: receivedPaise - totalPaise,
  };
}

export function localStockDeductions(
  sales: OfflineSaleRecord[],
  snapshotSavedAt?: number,
): LocalStockDeductions {
  const snapshotTime = snapshotSavedAt ?? Number.POSITIVE_INFINITY;
  const out: LocalStockDeductions = {};
  for (const sale of sales) {
    if (sale.syncState === "cancelled") continue;
    if (sale.syncState === "synced"
      && sale.inventoryCoveredAt
      && new Date(sale.inventoryCoveredAt).getTime() <= snapshotTime) continue;
    for (const line of sale.lines) {
      out[line.productId] = (out[line.productId] ?? 0) + line.qtyBase;
    }
  }
  return out;
}

export function applyLocalStockDeductions<T extends ProductDTO>(
  items: T[],
  deductions: LocalStockDeductions,
): T[] {
  return items.map((item) => ({
    ...item,
    availableBase: Math.max(0, item.availableBase - (deductions[item._id] ?? 0)),
  }));
}

function saleCanUseProducts(
  sale: OfflineSaleRecord,
  products: ProductDTO[],
  otherDeductions: LocalStockDeductions,
): { ok: true } | { ok: false; reason: string } {
  const byId = new Map(products.map((product) => [product._id, product]));
  for (const line of sale.lines) {
    const product = byId.get(line.productId);
    if (!product) return { ok: false, reason: `${line.name} is not in the refreshed product catalogue.` };
    if (product.status !== "active") return { ok: false, reason: `${line.name} is not active on the server.` };
    if (typeof product.basePricePaise !== "number") return { ok: false, reason: `${line.name} has no server price.` };
    if (line.saleUnit !== product.saleUnit) return { ok: false, reason: `${line.name} has a changed sale unit on the server.` };
    if (line.unitPricePaise !== product.basePricePaise) return { ok: false, reason: `${line.name} has a changed price on the server.` };
    if (line.taxRateBps !== product.taxRateBps) return { ok: false, reason: `${line.name} has a changed tax rule on the server.` };
    const availableBase = Math.max(0, product.availableBase - (otherDeductions[line.productId] ?? 0));
    if (line.qtyBase > availableBase) {
      const requested = fromBaseQuantity(line.qtyBase, line.saleUnit as Parameters<typeof fromBaseQuantity>[1]);
      const available = fromBaseQuantity(availableBase, line.saleUnit as Parameters<typeof fromBaseQuantity>[1]);
      return { ok: false, reason: `${line.name} needs ${requested} ${line.saleUnit}, but only ${available} ${line.saleUnit} is available in the refreshed catalogue.` };
    }
  }
  return { ok: true };
}

function stockRecheckCandidate(sale: OfflineSaleRecord): boolean {
  if (sale.syncState !== "blocked" && sale.syncState !== "needs_review") return false;
  const message = sale.syncMessage?.toLowerCase() ?? "";
  if (!message) return true;
  return ["stock", "inventory", "available", "catalogue", "product", "server"].some((word) => message.includes(word));
}

function buildOfflineLines(lines: CartLine[]): OfflineSaleLine[] {
  return lines.map((line) => {
    const qtyBase = toBaseQuantity(line.qty, line.saleUnit);
    const totals = computeLineTotals({
      qtyBase,
      unitPricePaise: line.product.basePricePaise ?? 0,
      basePerSaleUnit: line.product.basePerSaleUnit,
      taxRateBps: line.product.taxRateBps ?? 0,
      discountPaise: line.discountPaise,
    });
    return {
      productId: line.product._id,
      productSlug: line.product.slug,
      sku: line.product.sku,
      barcode: line.product.barcode,
      name: line.product.name,
      saleUnit: line.saleUnit,
      qty: line.qty,
      qtyBase,
      basePerSaleUnit: line.product.basePerSaleUnit,
      unitPricePaise: line.product.basePricePaise ?? 0,
      grossPaise: totals.grossPaise,
      discountPaise: totals.discountPaise,
      taxablePaise: totals.taxablePaise,
      taxRateBps: line.product.taxRateBps ?? 0,
      taxPaise: totals.taxPaise,
      netPaise: totals.netPaise,
      lotEvidence: (line.product.lots ?? []).map((lot) => ({
        lotId: lot.lotId,
        lotCode: lot.lotCode,
        qtyBase: lot.qty,
        expiresAt: lot.expiresAt,
      })),
    };
  });
}

function recalculateOfflineLine(line: OfflineSaleLine, qty: number): OfflineSaleLine {
  const qtyBase = toBaseQuantity(qty, line.saleUnit as Parameters<typeof toBaseQuantity>[1]);
  const totals = computeLineTotals({
    qtyBase,
    unitPricePaise: line.unitPricePaise,
    basePerSaleUnit: line.basePerSaleUnit,
    taxRateBps: line.taxRateBps,
    discountPaise: Math.min(line.discountPaise, Math.max(0, Math.round((line.discountPaise * qtyBase) / Math.max(1, line.qtyBase)))),
  });
  return {
    ...line,
    qty,
    qtyBase,
    grossPaise: totals.grossPaise,
    discountPaise: totals.discountPaise,
    taxablePaise: totals.taxablePaise,
    taxPaise: totals.taxPaise,
    netPaise: totals.netPaise,
  };
}

export function applyOfflineSaleLineRepair(
  sale: OfflineSaleRecord,
  changes: Array<{ productId: string; qty?: number; remove?: boolean }>,
): OfflineSaleRecord {
  const byProduct = new Map(changes.map((change) => [change.productId, change]));
  const lines: OfflineSaleLine[] = [];
  for (const line of sale.lines) {
    const change = byProduct.get(line.productId);
    if (change?.remove) continue;
    if (typeof change?.qty === "number") {
      if (!Number.isFinite(change.qty) || change.qty <= 0) throw new Error("Enter a quantity greater than zero.");
      if (toBaseQuantity(change.qty, line.saleUnit as Parameters<typeof toBaseQuantity>[1]) > line.qtyBase) throw new Error("Quantity can only be reduced while repairing an offline sale.");
      lines.push(recalculateOfflineLine(line, change.qty));
    } else {
      lines.push(line);
    }
  }
  if (lines.length === 0) throw new Error("At least one product must remain. Cancel the local sale instead.");
  const totals = sumCartTotals(lines);
  const payment = validateCashPayment(totals.netPaise, sale.payment.receivedPaise);
  return {
    ...sale,
    lines,
    grossPaise: totals.grossPaise,
    discountPaise: totals.discountPaise,
    taxPaise: totals.taxPaise,
    totalPaise: totals.netPaise,
    payment,
  };
}

export function buildOfflineSaleRecord(
  input: OfflineSaleInput,
  receiptSequence: number,
  now = new Date(),
  existingDeductions: LocalStockDeductions = {},
): OfflineSaleRecord {
  if (input.lines.length === 0) throw new Error("Add at least one product before checkout.");
  for (const line of input.lines) {
    if ((line.product as ProductDTO).status !== "active") throw new Error(`${line.product.name} is not active.`);
    if (typeof line.product.basePricePaise !== "number") throw new Error(`${line.product.name} has no saved price.`);
    const qtyBase = toBaseQuantity(line.qty, line.saleUnit);
    // Offline stock is advisory only. The seller may record the sale even when
    // local stock is exhausted; the server records any resulting shortfall as
    // a separate reconciliation item during sync.
  }
  const saleLines = buildOfflineLines(input.lines);
  const cart = sumCartTotals(saleLines);
  const payment = validateCashPayment(cart.netPaise, input.cashReceivedPaise);
  const operationId = input.operationId ?? newUuid();
  const receiptNo = `LOCAL-${input.session.registerId.slice(0, 8).toUpperCase()}-${String(receiptSequence).padStart(6, "0")}`;
  const timestamp = now.toISOString();
  return {
    id: operationId,
    operationId,
    scope: input.scope,
    registerId: input.session.registerId,
    sessionId: input.session._id,
    receiptNo,
    receiptSequence,
    status: "completed",
    syncState: "pending",
    offlineGrantToken: input.offlineGrantToken,
    catalogueSnapshotVersion: input.catalogueSnapshotVersion ?? "catalogue-unknown",
    catalogueEffectiveAt: input.catalogueEffectiveAt ?? timestamp,
    pricingPolicyVersion: input.pricingPolicyVersion ?? OFFLINE_PRICING_POLICY_VERSION,
    inventoryCursor: input.inventoryCursor ?? "0",
    lines: saleLines,
    grossPaise: cart.grossPaise,
    discountPaise: cart.discountPaise,
    taxPaise: cart.taxPaise,
    totalPaise: cart.netPaise,
    payment,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || undefined,
    buyerCode: input.buyerCode?.trim() || undefined,
    marketingConsent: Boolean(input.marketingConsent),
    cashierId: input.cashierId,
    soldAt: timestamp,
    createdAt: timestamp,
    schemaVersion: 2,
  };
}

export async function saveOfflineSessionContext(scope: OfflineScope, session: SessionDTO): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(CONTEXT_STORE, "readwrite");
    tx.objectStore(CONTEXT_STORE).put({ session, savedAt: Date.now() }, offlineScopeKey(scope));
    await txDone(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function readOfflineSessionContext(scope: OfflineScope): Promise<{ session: SessionDTO; savedAt: number } | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(CONTEXT_STORE, "readonly");
    const result = await requestResult<{ session: SessionDTO; savedAt: number } | undefined>(
      tx.objectStore(CONTEXT_STORE).get(offlineScopeKey(scope)),
    );
    await txDone(tx);
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

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


export interface OfflineSalesExport {
  exportedAt: string;
  scope: OfflineScope;
  sales: OfflineSaleRecord[];
}

export async function exportOfflineSales(scope: OfflineScope): Promise<OfflineSalesExport> {
  return {
    exportedAt: new Date().toISOString(),
    scope,
    sales: await listOfflineSales(scope),
  };
}

export interface OfflineSalesImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const IMPORTABLE_SYNC_STATES = new Set<OfflineSaleSyncState>(["pending", "uploading", "retry_wait", "synced", "blocked", "cancelled", "needs_review", "auth_required"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidOfflineScope(value: unknown, scope: OfflineScope): value is OfflineScope {
  return isObject(value)
    && value.userId === scope.userId
    && value.orgId === scope.orgId
    && value.locationId === scope.locationId;
}

function validateImportedSale(value: unknown, scope: OfflineScope, index: number): OfflineSaleRecord | string {
  if (!isObject(value)) return `Record ${index + 1} is not an object.`;
  const requiredStrings = ["id", "operationId", "registerId", "sessionId", "receiptNo", "customerName", "cashierId", "soldAt", "createdAt", "catalogueSnapshotVersion", "catalogueEffectiveAt", "pricingPolicyVersion"];
  if (requiredStrings.some((key) => typeof value[key] !== "string" || !String(value[key]).trim())) return `Record ${index + 1} is missing required text fields.`;
  if (value.id !== value.operationId) return `Record ${index + 1} has mismatched record and operation IDs.`;
  if (!isValidOfflineScope(value.scope, scope)) return `Record ${index + 1} belongs to a different user, organization, or location.`;
  if (value.status !== "completed" || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) return `Record ${index + 1} has an unsupported schema or status.`;
  if (typeof value.syncState !== "string" || !IMPORTABLE_SYNC_STATES.has(value.syncState as OfflineSaleSyncState)) return `Record ${index + 1} has an unsupported sync state.`;
  if (!Array.isArray(value.lines) || value.lines.length === 0) return `Record ${index + 1} must contain at least one product line.`;
  if (!isObject(value.payment) || value.payment.method !== "cash" || !finiteNonNegative(value.payment.amountPaise) || !finiteNonNegative(value.payment.receivedPaise) || !finiteNonNegative(value.payment.changePaise)) return `Record ${index + 1} has invalid payment data.`;
  for (const [lineIndex, line] of value.lines.entries()) {
    if (!isObject(line) || ["productId", "sku", "name", "saleUnit"].some((key) => typeof line[key] !== "string" || !String(line[key]).trim()) || !finiteNonNegative(line.qty) || line.qty <= 0 || !finiteNonNegative(line.qtyBase) || !finiteNonNegative(line.unitPricePaise) || !finiteNonNegative(line.grossPaise) || !finiteNonNegative(line.discountPaise) || !finiteNonNegative(line.taxablePaise) || !finiteNonNegative(line.taxRateBps) || !finiteNonNegative(line.taxPaise) || !finiteNonNegative(line.netPaise)) {
      return `Record ${index + 1}, line ${lineIndex + 1} has invalid product data.`;
    }
  }
  const dateFields = ["soldAt", "createdAt", "catalogueEffectiveAt"];
  if (dateFields.some((key) => Number.isNaN(Date.parse(String(value[key]))))) return `Record ${index + 1} has an invalid date.`;
  const rawState = value.syncState as OfflineSaleSyncState;
  return {
    ...(value as unknown as OfflineSaleRecord),
    syncState: rawState === "uploading" ? "pending" : rawState,
    syncMessage: rawState === "uploading" ? "Restored from backup and queued for sync." : typeof value.syncMessage === "string" ? value.syncMessage : undefined,
  };
}

/**
 * Restores only records for the current scope. Existing records are never
 * replaced, and pending records are re-created in the outbox atomically.
 */
export async function importOfflineSales(scope: OfflineScope, payload: unknown): Promise<OfflineSalesImportResult> {
  const result: OfflineSalesImportResult = { imported: 0, skipped: 0, errors: [] };
  if (!isObject(payload) || !isValidOfflineScope(payload.scope, scope) || !Array.isArray(payload.sales)) {
    result.errors.push("This backup is invalid or belongs to a different user, organization, or location.");
    return result;
  }
  const candidates: OfflineSaleRecord[] = [];
  const seen = new Set<string>();
  for (const [index, value] of payload.sales.entries()) {
    const sale = validateImportedSale(value, scope, index);
    if (typeof sale === "string") {
      result.errors.push(sale);
      continue;
    }
    if (seen.has(sale.operationId)) {
      result.skipped += 1;
      continue;
    }
    seen.add(sale.operationId);
    candidates.push(sale);
  }
  if (candidates.length === 0) return result;
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const salesStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const existingSales = await requestResult<OfflineSaleRecord[]>(salesStore.getAll());
    const existingOperationIds = new Set(existingSales.map((sale) => sale.operationId));
    for (const sale of candidates) {
      if (existingOperationIds.has(sale.operationId)) {
        result.skipped += 1;
        continue;
      }
      salesStore.add(sale);
      if (["pending", "retry_wait", "auth_required"].includes(sale.syncState)) {
        const now = new Date().toISOString();
        outboxStore.add({
          id: sale.operationId,
          saleId: sale.id,
          operationId: sale.operationId,
          scope: sale.scope,
          kind: "sale.cash.v1",
          status: "pending",
          attempts: sale.syncAttempts ?? 0,
          nextAttemptAt: now,
          createdAt: sale.createdAt,
          updatedAt: now,
        } satisfies OfflineOutboxEntry);
      }
      existingOperationIds.add(sale.operationId);
      result.imported += 1;
    }
    await txDone(tx);
    notifyOfflineSalesChanged();
    return result;
  } catch (error) {
    throw storageError(error);
  } finally {
    db.close();
  }
}

export async function markOfflineSaleSyncState(
  scope: OfflineScope,
  operationId: string,
  syncState: OfflineSaleSyncState,
  detail?: { message?: string; failureStage?: string; failureCode?: string; failureDetail?: string; requestId?: string; traceId?: string; serverSaleId?: string; serverReceiptNo?: string; inventoryCoveredAt?: string; serverInventoryCursor?: string },
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
    sale.serverSaleId = detail?.serverSaleId ?? sale.serverSaleId;
    sale.serverReceiptNo = detail?.serverReceiptNo ?? sale.serverReceiptNo;
    sale.inventoryCoveredAt = detail?.inventoryCoveredAt ?? sale.inventoryCoveredAt;
    sale.serverInventoryCursor = detail?.serverInventoryCursor ?? sale.serverInventoryCursor;
    sale.lastSyncAttemptAt = new Date().toISOString();
    saleStore.put(sale);
    if (syncState === "synced") {
      outboxStore.delete(operationId);
    } else {
      const outbox = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(operationId));
      if (outbox) {
        outbox.status = syncState === "auth_required" ? "auth_required" : syncState === "blocked" || syncState === "cancelled" || syncState === "needs_review" ? syncState : "retry_wait";
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

export interface OfflineSaleCustomerPatch {
  customerName: string;
  customerPhone?: string;
  buyerCode?: string;
  marketingConsent?: boolean;
}

function normalizeOfflinePhone(value?: string): string | undefined {
  const digits = (value ?? "").replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!national) return undefined;
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
    const existing = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(operationId));
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
  if (buyerCode && !/^BYR-[A-F0-9]{10}$/.test(buyerCode)) throw new Error("Enter a valid buyer code.");
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
    const existing = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(operationId));
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

export async function cancelOfflineSale(scope: OfflineScope, operationId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (!sale || offlineScopeKey(sale.scope) !== offlineScopeKey(scope) || sale.syncState === "synced") {
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

export async function cleanupOfflineSales(scope: OfflineScope, olderThanMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
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
      const otherDeductions = localStockDeductions(scopedSales.filter((other) => other.operationId !== sale.operationId), snapshotSavedAt);
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
      const existing = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(sale.operationId));
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

export async function requeueOfflineSale(scope: OfflineScope, operationId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (!sale || offlineScopeKey(sale.scope) !== offlineScopeKey(scope) || sale.syncState === "synced") {
      tx.abort();
      db.close();
      return false;
    }
    const now = new Date().toISOString();
    sale.syncState = "pending";
    sale.syncMessage = "Queued for another automatic sync check.";
    sale.lastSyncAttemptAt = now;
    saleStore.put(sale);
    const existing = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(operationId));
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

export interface OfflineSaleSyncDiagnostic {
  failureStage?: string;
  failureCode?: string;
  failureDetail?: string;
  requestId?: string;
  traceId?: string;
}

export async function incrementOfflineSaleAttempt(scope: OfflineScope, operationId: string, retryInMs: number, message?: string, diagnostic?: OfflineSaleSyncDiagnostic): Promise<void> {
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
      qty: String(fromBaseQuantity(line.qtyBase, line.saleUnit as Parameters<typeof fromBaseQuantity>[1])),
      unit: line.saleUnit,
      unitPriceMinor: line.unitPricePaise,
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
