import { catalogueRequest, request, type ApiResult } from "./client";
import type { IProduct } from "@/shared/interfaces/mongodb/catalog/product";
import type { CreateProductInput, UpdateProductInput } from "@/shared/schemas/product";
import type { PageMeta } from "@/app/api/v1/utils/responses";

export type ProductDTO = IProduct & { _id: string };

export interface ProductListResult {
  items: ProductDTO[];
  meta: PageMeta;
}

export const list = async (params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<ApiResult<ProductListResult>> => {
  const result = await catalogueRequest<{ products: Array<ProductDTO & { id?: string }>; meta: PageMeta }>("/products", { query: params });
  return {
    ...result,
    data: result.data ? { items: result.data.products.map((item) => ({ ...item, _id: item._id ?? item.id ?? "" })), meta: result.data.meta } : null,
  };
};

export const get = async (id: string): Promise<ApiResult<ProductDTO>> => {
  const result = await catalogueRequest<ProductDTO & { id?: string }>(`/products/${id}`);
  return { ...result, data: result.data ? { ...result.data, _id: result.data._id ?? result.data.id ?? "" } : null };
};

export const create = (body: CreateProductInput): Promise<ApiResult<ProductDTO>> =>
  request<ProductDTO>("/products", { method: "POST", body });

export const update = (
  id: string,
  body: UpdateProductInput,
): Promise<ApiResult<ProductDTO>> =>
  request<ProductDTO>(`/products/${id}`, { method: "PATCH", body });
