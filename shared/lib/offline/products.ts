import type { ProductDTO, ProductListResult } from "../api/products";

/**
 * This policy describes the values that are frozen into an offline sale.
 * Automatic server promotions are deliberately not included in the first
 * offline release; discounts entered by the cashier are retained on the sale.
 */
export const OFFLINE_PRICING_POLICY_VERSION = "pos-price-tax-manual-discount-v1";
export const OFFLINE_CATALOGUE_STALE_MS = 15 * 60_000;

export interface ProductSnapshot {
  items: ProductDTO[];
  savedAt: number;
  snapshotVersion: string;
  effectiveAt: string;
  pricingPolicyVersion: string;
  inventoryCursor: string;
}
let scope: string | null = null;

function hashSnapshot(items: ProductDTO[]): string {
  const canonical = [...items]
    .sort((a, b) => a._id.localeCompare(b._id))
    .map((item) =>
      [
        item._id,
        item.sku,
        item.barcode ?? "",
        item.name,
        item.saleUnit,
        item.basePerSaleUnit,
        item.basePricePaise ?? null,
        item.taxRateBps,
        item.status,
        item.availableBase,
        (item.lots ?? [])
          .map((lot) => [lot.lotId, lot.lotCode, lot.qty, lot.expiresAt ?? ""].join("\u001d"))
          .join("\u001c"),
      ].join("\u001f"),
    )
    .join("\u001e");
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `catalogue-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createProductSnapshot(
  items: ProductDTO[],
  savedAt = Date.now(),
  inventoryCursor = "0",
): ProductSnapshot {
  return {
    items,
    savedAt,
    snapshotVersion: hashSnapshot(items),
    effectiveAt: new Date(savedAt).toISOString(),
    pricingPolicyVersion: OFFLINE_PRICING_POLICY_VERSION,
    inventoryCursor,
  };
}

export function productSnapshotIsStale(
  snapshot: ProductSnapshot | null,
  now = Date.now(),
  maxAgeMs = OFFLINE_CATALOGUE_STALE_MS,
): boolean {
  return !snapshot || !Number.isFinite(snapshot.savedAt) || now - snapshot.savedAt >= maxAgeMs;
}

function normalizeSnapshot(value: Partial<ProductSnapshot> | undefined): ProductSnapshot | null {
  if (!value || !Array.isArray(value.items)) return null;
  const savedAt = typeof value.savedAt === "number" ? value.savedAt : Date.now();
  const items = value.items as ProductDTO[];
  return {
    ...createProductSnapshot(
      items,
      savedAt,
      typeof value.inventoryCursor === "string" ? value.inventoryCursor : "0",
    ),
    snapshotVersion: value.snapshotVersion || hashSnapshot(items),
    effectiveAt: value.effectiveAt || new Date(savedAt).toISOString(),
    pricingPolicyVersion: value.pricingPolicyVersion || OFFLINE_PRICING_POLICY_VERSION,
    inventoryCursor: value.inventoryCursor || "0",
  };
}

export function setProductScope(user: { id: string; orgId: string; locationId: string } | null) {
  scope = user ? JSON.stringify([user.id, user.orgId, user.locationId]) : null;
}
export function productScope() {
  return scope;
}
export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("komola-offline-products-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("catalogues");
    request.onblocked = () =>
      reject(
        new Error(
          "Offline catalogue storage is waiting for another KOMOLA tab to close. Close older tabs and try again.",
        ),
      );
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Offline catalogue storage could not be opened."));
  });
}
export async function readProducts(key = scope): Promise<ProductSnapshot | null> {
  if (!key || typeof indexedDB === "undefined") return null;
  try {
    const db = await database();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("catalogues", "readonly");
      const request = tx.objectStore("catalogues").get(key);
      request.onsuccess = () => resolve(key === scope ? normalizeSnapshot(request.result) : null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    return null;
  }
}
export async function writeProducts(
  items: ProductDTO[],
  key = scope,
  snapshot = createProductSnapshot(items),
): Promise<boolean> {
  if (!key || key !== scope || typeof indexedDB === "undefined") return false;
  try {
    const db = await database();
    if (key !== scope) {
      db.close();
      return false;
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("catalogues", "readwrite");
      tx.objectStore("catalogues").put(snapshot, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    return true;
  } catch {
    return false;
  }
}

interface ProductLookupIndex {
  barcodes: Map<string, ProductDTO>;
  skus: Map<string, ProductDTO>;
}

const lookupIndexes = new WeakMap<ProductDTO[], ProductLookupIndex>();

function lookupIndex(items: ProductDTO[]): ProductLookupIndex {
  const existing = lookupIndexes.get(items);
  if (existing) return existing;
  const index: ProductLookupIndex = { barcodes: new Map(), skus: new Map() };
  for (const item of items) {
    index.skus.set(item.sku.toLowerCase(), item);
    if (item.barcode) index.barcodes.set(item.barcode.toLowerCase(), item);
  }
  lookupIndexes.set(items, index);
  return index;
}

/** Exact scanner lookup is indexed after the first use of a snapshot. */
export function lookupProduct(
  items: ProductDTO[],
  opts: { barcode?: string; sku?: string },
): ProductDTO | undefined {
  const barcode = opts.barcode?.trim().toLowerCase();
  const sku = opts.sku?.trim().toLowerCase();
  const index = lookupIndex(items);
  return (
    (barcode ? index.barcodes.get(barcode) : undefined) ?? (sku ? index.skus.get(sku) : undefined)
  );
}
export function searchProducts(
  items: ProductDTO[],
  params?: { q?: string; status?: string; page?: number; limit?: number },
): ProductListResult {
  const q = params?.q?.trim().toLowerCase() ?? "";
  const filtered = items.filter(
    (p) =>
      (!params?.status || params.status === "all" || p.status === params.status) &&
      (!q || [p.name, p.sku, p.barcode ?? ""].some((value) => value.toLowerCase().includes(q))),
  );
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, params?.limit ?? 50);
  return {
    items: filtered.slice((page - 1) * limit, page * limit),
    meta: {
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
  };
}
