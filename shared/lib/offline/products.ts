import type { ProductDTO, ProductListResult } from "../api/products";

export interface ProductSnapshot { items: ProductDTO[]; savedAt: number }
let scope: string | null = null;
export function setProductScope(user: { id: string; orgId: string; locationId: string } | null) {
  scope = user ? JSON.stringify([user.id, user.orgId, user.locationId]) : null;
}
export function productScope() { return scope; }
export function isOffline() { return typeof navigator !== "undefined" && !navigator.onLine; }

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("komola-offline-products-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("catalogues");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readProducts(key = scope): Promise<ProductSnapshot | null> {
  if (!key || typeof indexedDB === "undefined") return null;
  try {
    const db = await database();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("catalogues", "readonly");
      const request = tx.objectStore("catalogues").get(key);
      request.onsuccess = () => resolve(key === scope ? request.result ?? null : null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch { return null; }
}
export async function writeProducts(items: ProductDTO[], key = scope): Promise<boolean> {
  if (!key || key !== scope || typeof indexedDB === "undefined") return false;
  try {
    const db = await database();
    if (key !== scope) { db.close(); return false; }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("catalogues", "readwrite");
      tx.objectStore("catalogues").put({ items, savedAt: Date.now() }, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
    return true;
  } catch { return false; }
}
export function searchProducts(items: ProductDTO[], params?: { q?: string; status?: string; page?: number; limit?: number }): ProductListResult {
  const q = params?.q?.trim().toLowerCase() ?? "";
  const filtered = items.filter(p => (!params?.status || params.status === "all" || p.status === params.status)
    && (!q || [p.name, p.sku, p.barcode ?? ""].some(value => value.toLowerCase().includes(q))));
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, params?.limit ?? 50);
  return { items: filtered.slice((page - 1) * limit, page * limit), meta: { total: filtered.length, page, limit, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) } };
}
