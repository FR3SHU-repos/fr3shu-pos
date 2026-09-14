import { isOffline, productScope, readProducts, searchProducts, writeProducts } from "../offline/products";
import { goRequest, type ApiResult } from "./client";
import {
  mapProduct,
  type GoProduct,
  type Producer,
  type ProducerKind,
  type ProductDTO,
  type SupplierDTO,
} from "./_map";
import type { PageMeta } from "@/app/api/v1/utils/responses";
import {
  applyLocalStockDeductions,
  listOfflineSales,
  localStockDeductions,
  type OfflineScope,
} from "@/shared/lib/offline/sales";

export type { ProductDTO, Producer, ProducerKind, SupplierDTO };

export interface ProductListResult {
  items: ProductDTO[];
  meta: PageMeta;
}
export interface ProductMutation {
  name: string;
  description?: string;
  categoryId?: string;
  saleUnit: string;
  basePricePaise?: number;
  taxRateBps: number;
  organicStatus: ProductDTO["organicStatus"];
  status?: ProductDTO["status"];
  isPinned?: boolean;
  producer?: Producer;
}

export const list = async (params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  signal?: AbortSignal;
}): Promise<ApiResult<ProductListResult>> => {
  if (isOffline()) {
    const snapshot = await readProducts();
    return snapshot ? cached(searchProducts(await applyOfflineStockOverlay(snapshot.items, snapshot.savedAt), params)) : unavailable();
  }
  const res = await goRequest<{ items: GoProduct[]; meta: PageMeta }>("catalogue/products", {
    query: { q: params?.q, page: params?.page, limit: params?.limit, status: params?.status },
    signal: params?.signal,
  });
  if ((res.status === 0 || res.status >= 500) && !params?.signal?.aborted) {
    const snapshot = await readProducts();
    if (snapshot) return cached(searchProducts(await applyOfflineStockOverlay(snapshot.items, snapshot.savedAt), params));
  }
  return {
    ...res,
    data: res.data
      ? { items: res.data.items.map(mapProduct), meta: res.data.meta }
      : null,
  };
};

export const get = async (id: string): Promise<ApiResult<ProductDTO>> => {
  if (isOffline()) return offlineProduct(p => p._id === id);
  const res = await goRequest<GoProduct>(`catalogue/products/${id}`);
  if (res.status === 0 || res.status >= 500) return offlineProduct(p => p._id === id);
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

/** Barcode / SKU scanner lookup. */
export const lookup = async (opts: { barcode?: string; sku?: string }): Promise<ApiResult<ProductDTO>> => {
  const matches = (p: ProductDTO) => Boolean((opts.barcode && p.barcode === opts.barcode) || (opts.sku && p.sku === opts.sku));
  if (isOffline()) return offlineProduct(matches);
  const res = await goRequest<GoProduct>("catalogue/lookup", { query: opts });
  if (res.status === 0 || res.status >= 500) return offlineProduct(matches);
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

export const create = async (body: ProductMutation): Promise<ApiResult<ProductDTO>> => {
  if (isOffline()) return unavailable("Connect to the internet to create products. Changes have not been saved.");
  const res = await goRequest<GoProduct>("catalogue/products", { method: "POST", body });
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

export const update = async (id: string, body: ProductMutation): Promise<ApiResult<ProductDTO>> => {
  if (isOffline()) return unavailable("Connect to the internet to edit products. Changes have not been saved.");
  const res = await goRequest<GoProduct>(`catalogue/products/${id}`, { method: "PATCH", body });
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

function cached<T>(data: T): ApiResult<T> {
  return { success: true, data, status: 200, code: "offline_cache", message: "Saved catalogue · prices and stock may have changed" };
}
function unavailable<T>(message = "No saved product data. Connect and sync the catalogue first."): ApiResult<T> {
  return { success: false, data: null, status: 0, code: "offline_unavailable", message };
}
async function offlineProduct(matches: (p: ProductDTO) => boolean): Promise<ApiResult<ProductDTO>> {
  const snapshot = await readProducts();
  const items = snapshot ? await applyOfflineStockOverlay(snapshot.items, snapshot.savedAt) : [];
  const product = items.find(matches);
  return product ? cached(product) : unavailable("Product unavailable in the saved catalogue. Connect and sync to refresh it.");
}

function currentOfflineScope(): OfflineScope | null {
  const key = productScope();
  if (!key) return null;
  try {
    const [userId, orgId, locationId] = JSON.parse(key) as string[];
    if (!userId || !orgId || !locationId) return null;
    return { userId, orgId, locationId };
  } catch {
    return null;
  }
}

async function applyOfflineStockOverlay(items: ProductDTO[], snapshotSavedAt: number): Promise<ProductDTO[]> {
  const scope = currentOfflineScope();
  if (!scope) return items;
  const sales = await listOfflineSales(scope);
  return applyLocalStockDeductions(items, localStockDeductions(sales, snapshotSavedAt));
}

/** Replace the device snapshot only after every page downloads successfully. */
export async function refreshOfflineProducts(signal?: AbortSignal): Promise<{ items: ProductDTO[]; savedAt: number } | null> {
  const key = productScope();
  if (!key || isOffline()) return null;
  const items: ProductDTO[] = [];
  for (let page = 1; ; page++) {
    if (signal?.aborted || key !== productScope()) return null;
    const res = await goRequest<{ items: GoProduct[]; meta: PageMeta }>("catalogue/products", {
      query: { page, limit: 100, status: "all" }, signal,
    });
    if (!res.success || !res.data || signal?.aborted || key !== productScope()) return null;
    items.push(...res.data.items.map(mapProduct));
    if (page >= res.data.meta.totalPages) break;
    if (res.data.items.length === 0 || page >= 10000) return null;
  }
  const uniqueItems = Array.from(new Map(items.map(p => [p._id, p])).values());
  const saved = await writeProducts(uniqueItems, key);
  return saved ? { items: uniqueItems, savedAt: Date.now() } : null;
}

export async function syncOfflineProducts(signal?: AbortSignal): Promise<boolean> {
  return (await refreshOfflineProducts(signal)) !== null;
}
