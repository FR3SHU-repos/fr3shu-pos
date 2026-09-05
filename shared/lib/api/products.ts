import { goRequest, type ApiResult } from "./client";
import { mapProduct, type GoProduct, type ProductDTO } from "./_map";
import type { PageMeta } from "@/app/api/v1/utils/responses";

export type { ProductDTO };

export interface ProductListResult {
  items: ProductDTO[];
  meta: PageMeta;
}

const CENTRAL = "The product catalogue is managed centrally in go-api-backend; POS is read-only.";

export const list = async (params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<ApiResult<ProductListResult>> => {
  const res = await goRequest<{ items: GoProduct[]; meta: PageMeta }>("catalogue/products", {
    query: { q: params?.q, page: params?.page, limit: params?.limit },
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

export const create = async (_body?: unknown): Promise<ApiResult<ProductDTO>> => ({
  success: false,
  message: CENTRAL,
  data: null,
  status: 501,
});

export const update = async (_id?: string, _body?: unknown): Promise<ApiResult<ProductDTO>> => ({
  success: false,
  message: CENTRAL,
  data: null,
  status: 501,
});
