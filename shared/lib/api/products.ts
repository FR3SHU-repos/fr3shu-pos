import { request, type ApiResult } from "./client";
import type { IProduct } from "@/shared/interfaces/mongodb/catalog/product";
import type { CreateProductInput, UpdateProductInput } from "@/shared/schemas/product";
import type { PageMeta } from "@/app/api/v1/utils/responses";

export type ProductDTO = IProduct & { _id: string };

export interface ProductListResult {
  items: ProductDTO[];
  meta: PageMeta;
}

export const list = (params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<ApiResult<ProductListResult>> =>
  request<ProductListResult>("/products", { query: params });

export const get = (id: string): Promise<ApiResult<ProductDTO>> =>
  request<ProductDTO>(`/products/${id}`);

export const create = (body: CreateProductInput): Promise<ApiResult<ProductDTO>> =>
  request<ProductDTO>("/products", { method: "POST", body });

export const update = (
  id: string,
  body: UpdateProductInput,
): Promise<ApiResult<ProductDTO>> =>
  request<ProductDTO>(`/products/${id}`, { method: "PATCH", body });
