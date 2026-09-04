import { request, type ApiResult } from "./client";
import type { ICategory } from "@/shared/interfaces/mongodb/catalog/category";

export type CategoryDTO = ICategory & { _id: string };

export const list = (): Promise<ApiResult<{ items: CategoryDTO[] }>> =>
  request<{ items: CategoryDTO[] }>("/categories");

export const create = (body: {
  name: string;
  sortOrder?: number;
}): Promise<ApiResult<CategoryDTO>> =>
  request<CategoryDTO>("/categories", { method: "POST", body });
