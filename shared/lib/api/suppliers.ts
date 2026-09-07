import { goRequest, type ApiResult } from "./client";
import type { SupplierDTO } from "./_map";

export type { SupplierDTO };

/** The org's farmer/supplier directory (own-farm row last). */
export const list = async (): Promise<ApiResult<{ items: SupplierDTO[] }>> => {
  const res = await goRequest<{ items: SupplierDTO[] }>("catalogue/suppliers");
  return { ...res, data: res.data ? { items: res.data.items ?? [] } : null };
};
