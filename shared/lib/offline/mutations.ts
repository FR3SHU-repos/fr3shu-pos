import { goRequest } from "../api/client";
import { mapProduct, type GoProduct, type ProductDTO } from "../api/_map";
import type { ProductMutation } from "../api/products";
import type { AddStockBody, AddStockResult } from "../api/stock";
import { newUuid } from "../uuid";
import { unitFactor, unitBase } from "../api/_map";
import { productScope, readProducts, writeProducts, isOffline } from "./products";
import { applyOfflineMutationMappings, offlineScopeKey, type OfflineReferenceMappings, type OfflineScope } from "./sales";

type MutationKind = "product.create" | "stock.receipt";
type MutationStatus = "pending" | "syncing" | "blocked" | "synced";

interface OfflineMutation {
  id: string;
  scope: OfflineScope;
  kind: MutationKind;
  status: MutationStatus;
  payload: ProductMutation | AddStockBody;
  localProductId?: string;
  localLotId?: string;
  serverProductId?: string;
  serverLotId?: string;
  attempts: number;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = "komola-offline-mutations-v1";
const STORE = "mutations";

function notifyMutationChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("komola:offline-mutations-changed"));
    window.dispatchEvent(new Event("komola:offline-sales-changed"));
  }
}

function currentScope(): OfflineScope {
  const key = productScope();
  if (!key) throw new Error("Seller scope is not ready.");
  const [userId, orgId, locationId] = JSON.parse(key) as string[];
  if (!userId || !orgId || !locationId) throw new Error("Seller scope is not ready.");
  return { userId, orgId, locationId };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Offline mutation storage is unavailable."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putMutation(mutation: OfflineMutation): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(mutation);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function listAllMutations(scope: OfflineScope): Promise<OfflineMutation[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const all = await requestResult<OfflineMutation[]>(tx.objectStore(STORE).getAll());
    await txDone(tx);
    return all
      .filter((item) => offlineScopeKey(item.scope) === offlineScopeKey(scope))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

async function listMutations(scope: OfflineScope): Promise<OfflineMutation[]> {
  return (await listAllMutations(scope)).filter((item) => item.status !== "synced");
}

async function updateMutation(id: string, patch: Partial<OfflineMutation>): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const current = await requestResult<OfflineMutation | undefined>(store.get(id));
    if (current) store.put({ ...current, ...patch, updatedAt: new Date().toISOString() });
    await txDone(tx);
  } finally {
    db.close();
  }
}

function localProduct(body: ProductMutation, scope: OfflineScope): ProductDTO {
  const id = `offline-product-${newUuid()}`;
  const saleUnit = body.saleUnit as ProductDTO["saleUnit"];
  return {
    _id: id,
    id,
    productId: id,
    slug: `${body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"}-${id.slice(-8)}`,
    locationId: scope.locationId,
    name: body.name.trim(),
    sku: `LOCAL-${id.slice(-8).toUpperCase()}`,
    saleUnit,
    baseUnit: unitBase(saleUnit),
    basePerSaleUnit: unitFactor(saleUnit),
    basePricePaise: body.basePricePaise,
    taxRateBps: body.taxRateBps,
    categoryId: body.categoryId,
    description: body.description,
    organicStatus: body.organicStatus,
    status: body.status ?? "active",
    isPinned: body.isPinned ?? false,
    availableBase: 0,
    lots: [],
    imageUrl: body.imageUrl,
    producer: body.producer,
  };
}

export async function queueOfflineProductCreate(body: ProductMutation): Promise<ProductDTO> {
  const scope = currentScope();
  const product = localProduct(body, scope);
  const snapshot = await readProducts();
  const items = snapshot ? [...snapshot.items, product] : [product];
  if (!await writeProducts(items, productScope() ?? undefined)) {
    throw new Error("Offline catalogue storage could not save this product.");
  }
  const now = new Date().toISOString();
  await putMutation({
    id: newUuid(), scope, kind: "product.create", status: "pending", payload: body,
    localProductId: product._id, attempts: 0, createdAt: now, updatedAt: now,
  });
  notifyMutationChange();
  return product;
}

export async function queueOfflineStockReceipt(body: AddStockBody): Promise<AddStockResult> {
  const scope = currentScope();
  const snapshot = await readProducts();
  const product = snapshot?.items.find((item) => item._id === body.skuId);
  if (!product) throw new Error("Product is not available in the saved catalogue.");
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a valid quantity.");
  const lotId = `offline-lot-${newUuid()}`;
  const lotCode = body.lotCode?.trim() || `offline-${new Date().toISOString().slice(0, 10)}`;
  const nextProduct: ProductDTO = {
    ...product,
    availableBase: product.availableBase + quantity * product.basePerSaleUnit,
    lots: [...(product.lots ?? []), { lotId, lotCode, qty: quantity, expiresAt: body.expiresAt }],
  };
  const items = snapshot!.items.map((item) => item._id === product._id ? nextProduct : item);
  if (!await writeProducts(items, productScope() ?? undefined)) {
    throw new Error("Offline catalogue storage could not save this stock receipt.");
  }
  const now = new Date().toISOString();
  await putMutation({
    id: newUuid(), scope, kind: "stock.receipt", status: "pending", payload: body,
    localProductId: product._id, localLotId: lotId, attempts: 0, createdAt: now, updatedAt: now,
  });
  notifyMutationChange();
  return { lotId, lotCode, skuId: product._id, unit: product.saleUnit, quantity: body.quantity, expiresAt: body.expiresAt };
}

async function replaceLocalProduct(localProductId: string, product: ProductDTO): Promise<void> {
  const snapshot = await readProducts();
  if (!snapshot) return;
  const local = snapshot.items.find((item) => item._id === localProductId);
  const merged = local ? { ...product, availableBase: local.availableBase, lots: local.lots } : product;
  await writeProducts(snapshot.items.map((item) => item._id === localProductId ? merged : item));
}

function productPayload(res: { data?: GoProduct | { product?: GoProduct } | null }): GoProduct | null {
  if (!res.data) return null;
  const value = res.data as GoProduct | { product?: GoProduct };
  return "product" in value ? value.product ?? null : value as GoProduct;
}

export async function syncOfflineMutations(): Promise<{ synced: number; pending: number; blocked: number; messages: string[] }> {
  if (isOffline() || typeof indexedDB === "undefined") return { synced: 0, pending: 0, blocked: 0, messages: [] };
  const scope = currentScope();
  const all = await listAllMutations(scope);
  const pending = all.filter((item) => item.status !== "synced");
  let synced = 0;
  let blocked = 0;
  const messages: string[] = [];
  const mappings: OfflineReferenceMappings = { productIds: {}, lotIds: {} };
  for (const mutation of all) {
    if (mutation.kind === "product.create" && mutation.localProductId && mutation.serverProductId) {
      mappings.productIds[mutation.localProductId] = mutation.serverProductId;
    }
    if (mutation.kind === "stock.receipt" && mutation.localLotId && mutation.serverLotId) {
      mappings.lotIds[mutation.localLotId] = mutation.serverLotId;
    }
  }
  await applyOfflineMutationMappings(scope, mappings);
  for (const mutation of pending) {
    if (mutation.status === "blocked") { blocked += 1; continue; }
    await updateMutation(mutation.id, { status: "syncing", attempts: mutation.attempts + 1 });
    if (mutation.kind === "product.create") {
      const res = await goRequest<GoProduct | { product?: GoProduct }>("catalogue/products", { method: "POST", body: mutation.payload });
      const mapped = productPayload(res);
      if (!res.success || !mapped) {
        if (res.status >= 400 && res.status < 500) {
          await updateMutation(mutation.id, { status: "blocked", message: res.message });
          blocked += 1;
        } else {
          await updateMutation(mutation.id, { status: "pending", message: res.message });
        }
        continue;
      }
      const product = mapProduct(mapped);
      if (mutation.localProductId) {
        mappings.productIds[mutation.localProductId] = product._id;
        await replaceLocalProduct(mutation.localProductId, product);
      }
      await updateMutation(mutation.id, { status: "synced", serverProductId: product._id, message: `Product ${product.name} synced.` });
      synced += 1;
      messages.push(`Product ${product.name} synced.`);
      continue;
    }
    const payload = mutation.payload as AddStockBody;
    const skuId = mappings.productIds[payload.skuId] ?? payload.skuId;
    const res = await goRequest<AddStockResult>("inventory/receipts", {
      method: "POST", body: { ...payload, skuId },
    });
    if (!res.success || !res.data) {
      if (res.status >= 400 && res.status < 500) {
        await updateMutation(mutation.id, { status: "blocked", message: res.message });
        blocked += 1;
      } else {
        await updateMutation(mutation.id, { status: "pending", message: res.message });
      }
      continue;
    }
    if (mutation.localLotId && res.data.lotId) {
      mappings.lotIds[mutation.localLotId] = res.data.lotId;
    }
    await updateMutation(mutation.id, {
      status: "synced",
      serverProductId: res.data.skuId,
      serverLotId: res.data.lotId,
      message: "Stock receipt synced.",
    });
    synced += 1;
    messages.push("Stock receipt synced.");
  }
  await applyOfflineMutationMappings(scope, mappings);
  const remaining = await listMutations(scope);
  return { synced, pending: remaining.length, blocked, messages };
}

export async function offlineMutationSummary(scope: OfflineScope): Promise<{ pending: number; blocked: number }> {
  const mutations = await listMutations(scope);
  return {
    pending: mutations.filter((item) => item.status === "pending" || item.status === "syncing").length,
    blocked: mutations.filter((item) => item.status === "blocked").length,
  };
}
