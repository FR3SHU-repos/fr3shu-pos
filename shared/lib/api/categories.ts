import { goRequest, type ApiResult } from "./client";

export interface CategoryDTO {
  _id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  orgId: string;
}

interface GoCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export const list = async (): Promise<ApiResult<{ items: CategoryDTO[] }>> => {
  const res = await goRequest<{ items: GoCategory[] }>("catalogue/categories");
  return {
    ...res,
    data: res.data
      ? {
          items: res.data.items.map((c) => ({
            _id: c.id,
            name: c.name,
            slug: c.slug,
            sortOrder: c.sortOrder,
            isActive: true,
            orgId: "canonical",
          })),
        }
      : null,
  };
};

export const create = async (_body?: unknown): Promise<ApiResult<CategoryDTO>> => ({
  success: false,
  message: "Categories are managed centrally in go-api-backend; POS is read-only.",
  data: null,
  status: 501,
});
