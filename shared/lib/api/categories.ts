import { catalogueRequest, request, type ApiResult } from "./client";
import type { ICategory } from "@/shared/interfaces/mongodb/catalog/category";

export type CategoryDTO = ICategory & { _id: string };

export const list = async (): Promise<ApiResult<{ items: CategoryDTO[] }>> => {
  const result = await catalogueRequest<{ items: Array<CategoryDTO & { id?: string }> }>("/categories");
  if (result.data) {
    result.data.items = result.data.items.map((item) => ({ ...item, _id: item._id ?? item.id ?? "", orgId: item.orgId ?? "canonical" }));
  }
  return result as ApiResult<{ items: CategoryDTO[] }>;
};

export const create = (body: {
  name: string;
  sortOrder?: number;
}): Promise<ApiResult<CategoryDTO>> =>
  request<CategoryDTO>("/categories", { method: "POST", body });
