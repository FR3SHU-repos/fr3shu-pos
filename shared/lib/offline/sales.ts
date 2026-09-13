import type { ProductDTO } from "@/shared/lib/api/products";
import type { SaleDTO } from "@/shared/lib/api/sales";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { CartLine } from "@/shared/components/pos/types";
import { computeLineTotals, sumCartTotals } from "@/shared/lib/money";
import { fromBaseQuantity, toBaseQuantity } from "@/shared/lib/units";

export type OfflineSaleSyncState = "pending" | "uploading" | "retry_wait" | "synced" | "needs_review" | "auth_required";

export interface OfflineScope {
  userId: string;
  orgId: string;
  locationId: string;
}

export interface OfflineCashPayment {
  method: "cash";
  amountPaise: number;
  receivedPaise: number;
  changePaise: number;
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
  schemaVersion: 1;
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
}

export interface OfflineSaleSyncOperation {
  operationId: string;
  registerId: string;
  sessionId: string;
  deviceReceiptNo: string;
  occurredAt: string;
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
  }>;
  cashReceivedMinor: number;
  cashAppliedMinor: number;
  changeMinor: number;
  totalMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
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
}

const DB_NAME = "komola-offline-pos-v1";
const DB_VERSION = 1;
const SALE_STORE = "sales";
const OUTBOX_STORE = "outbox";
const CONTEXT_STORE = "contexts";
const META_STORE = "meta";

function notifyOfflineSalesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("komola:offline-sales-changed"));
}

export function offlineScopeKey(scope: OfflineScope): string {
  return JSON.stringify([scope.userId, scope.orgId, scope.locationId]);
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SALE_STORE)) db.createObjectStore(SALE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CONTEXT_STORE)) db.createObjectStore(CONTEXT_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
    };
  });
}

export function buildOfflineSaleRecord(
  input: OfflineSaleInput,
  receiptSequence: number,
  now = new Date(),
): OfflineSaleRecord {
  if (input.lines.length === 0) throw new Error("Add at least one product before checkout.");
  for (const line of input.lines) {
    if ((line.product as ProductDTO).status !== "active") throw new Error(`${line.product.name} is not active.`);
    if (typeof line.product.basePricePaise !== "number") throw new Error(`${line.product.name} has no saved price.`);
  }
  const saleLines = buildOfflineLines(input.lines);
  const cart = sumCartTotals(saleLines);
  const payment = validateCashPayment(cart.netPaise, input.cashReceivedPaise);
  const operationId = input.operationId ?? crypto.randomUUID();
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
    schemaVersion: 1,
  };
}

export async function saveOfflineSessionContext(scope: OfflineScope, session: SessionDTO): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await database();
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
    const db = await database();
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
  const db = await database();
  try {
    const key = offlineScopeKey(input.scope);
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE, META_STORE], "readwrite");
    const metaStore = tx.objectStore(META_STORE);
    const current = (await requestResult<number | undefined>(metaStore.get(`${key}:receipt-sequence`))) ?? 0;
    const next = current + 1;
    const sale = buildOfflineSaleRecord(input, next);
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
  } finally {
    db.close();
  }
}

export async function listPendingOfflineSales(scope: OfflineScope): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await database();
    const tx = db.transaction(SALE_STORE, "readonly");
    const all = await requestResult<OfflineSaleRecord[]>(tx.objectStore(SALE_STORE).getAll());
    await txDone(tx);
    db.close();
    const key = offlineScopeKey(scope);
    return all
      .filter((sale) => offlineScopeKey(sale.scope) === key && sale.syncState !== "synced")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

export async function listOfflineSales(scope: OfflineScope): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await database();
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

export async function markOfflineSaleSyncState(
  scope: OfflineScope,
  operationId: string,
  syncState: OfflineSaleSyncState,
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await database();
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
    saleStore.put(sale);
    if (syncState === "synced") {
      outboxStore.delete(operationId);
    } else {
      const outbox = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(operationId));
      if (outbox) {
        outbox.status = syncState === "auth_required" ? "auth_required" : syncState === "needs_review" ? "needs_review" : "retry_wait";
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

export async function incrementOfflineSaleAttempt(scope: OfflineScope, operationId: string, retryInMs: number): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await database();
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const outbox = await requestResult<OfflineOutboxEntry | undefined>(store.get(operationId));
    if (outbox && offlineScopeKey(outbox.scope) === offlineScopeKey(scope)) {
      outbox.status = "retry_wait";
      outbox.attempts += 1;
      outbox.updatedAt = new Date().toISOString();
      outbox.nextAttemptAt = new Date(Date.now() + retryInMs).toISOString();
      store.put(outbox);
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
    registerId: sale.registerId,
    sessionId: sale.sessionId,
    deviceReceiptNo: sale.receiptNo,
    occurredAt: sale.soldAt,
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
    receiptNo: sale.receiptNo,
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
