import type { ProductDTO } from "@/shared/lib/api/products";
import type { SaleDTO } from "@/shared/lib/api/sales";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { CartLine } from "@/shared/components/pos/types";
import { computeLineTotals, sumCartTotals } from "@/shared/lib/money";
import { fromBaseQuantity, toBaseQuantity } from "@/shared/lib/units";

export type OfflineSaleSyncState = "pending" | "uploading" | "retry_wait" | "synced" | "blocked" | "cancelled" | "needs_review" | "auth_required";

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
  syncMessage?: string;
  serverSaleId?: string;
  serverReceiptNo?: string;
  lastSyncAttemptAt?: string;
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

export type LocalStockDeductions = Record<string, number>;

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

export function localStockDeductions(
  sales: OfflineSaleRecord[],
  snapshotSavedAt?: number,
): LocalStockDeductions {
  const snapshotTime = snapshotSavedAt ?? Number.POSITIVE_INFINITY;
  const out: LocalStockDeductions = {};
  for (const sale of sales) {
    if (sale.syncState === "cancelled") continue;
    if (sale.syncState === "synced" && new Date(sale.createdAt).getTime() <= snapshotTime) continue;
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
    const availableBase = Math.max(0, line.product.availableBase - (existingDeductions[line.product._id] ?? 0));
    if (qtyBase > availableBase) throw new Error(`${line.product.name} does not have enough offline stock.`);
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
  } finally {
    db.close();
  }
}

export async function listPendingOfflineSales(scope: OfflineScope): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await database();
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

export async function markOfflineSaleSyncState(
  scope: OfflineScope,
  operationId: string,
  syncState: OfflineSaleSyncState,
  detail?: { message?: string; serverSaleId?: string; serverReceiptNo?: string },
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
    sale.syncMessage = detail?.message;
    sale.serverSaleId = detail?.serverSaleId ?? sale.serverSaleId;
    sale.serverReceiptNo = detail?.serverReceiptNo ?? sale.serverReceiptNo;
    sale.lastSyncAttemptAt = new Date().toISOString();
    saleStore.put(sale);
    if (syncState === "synced") {
      outboxStore.delete(operationId);
    } else {
      const outbox = await requestResult<OfflineOutboxEntry | undefined>(outboxStore.get(operationId));
      if (outbox) {
        outbox.status = syncState === "auth_required" ? "auth_required" : syncState === "blocked" || syncState === "cancelled" || syncState === "needs_review" ? syncState : "retry_wait";
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
  const db = await database();
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
  const db = await database();
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
    const db = await database();
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
    const db = await database();
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
    const db = await database();
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
    const db = await database();
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

export async function incrementOfflineSaleAttempt(scope: OfflineScope, operationId: string, retryInMs: number, message?: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await database();
    const tx = db.transaction([SALE_STORE, OUTBOX_STORE], "readwrite");
    const saleStore = tx.objectStore(SALE_STORE);
    const store = tx.objectStore(OUTBOX_STORE);
    const sale = await requestResult<OfflineSaleRecord | undefined>(saleStore.get(operationId));
    if (sale && offlineScopeKey(sale.scope) === offlineScopeKey(scope)) {
      sale.syncState = "retry_wait";
      sale.syncMessage = message ?? sale.syncMessage;
      sale.lastSyncAttemptAt = new Date().toISOString();
      saleStore.put(sale);
    }
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
