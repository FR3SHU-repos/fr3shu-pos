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
  const res = await goRequest<{ items: GoProduct[]; meta: PageMeta }>("catalogue/products", {
    query: { q: params?.q, page: params?.page, limit: params?.limit, status: params?.status },
    signal: params?.signal,
  });
  return {
    ...res,
    data: res.data
      ? { items: res.data.items.map(mapProduct), meta: res.data.meta }
      : null,
  };
};

export const get = async (id: string): Promise<ApiResult<ProductDTO>> => {
  const res = await goRequest<GoProduct>(`catalogue/products/${id}`);
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

/** Barcode / SKU scanner lookup. */
export const lookup = async (opts: { barcode?: string; sku?: string }): Promise<ApiResult<ProductDTO>> => {
  const res = await goRequest<GoProduct>("catalogue/lookup", { query: opts });
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

export const create = async (body: ProductMutation): Promise<ApiResult<ProductDTO>> => {
  const res = await goRequest<GoProduct>("catalogue/products", { method: "POST", body });
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};

export const update = async (id: string, body: ProductMutation): Promise<ApiResult<ProductDTO>> => {
  const res = await goRequest<GoProduct>(`catalogue/products/${id}`, { method: "PATCH", body });
  return { ...res, data: res.data ? mapProduct(res.data) : null };
};
