import { request, type ApiResult } from "./client";
import type { IInventoryBalance } from "@/shared/interfaces/mongodb/inventory/inventoryBalance";

export type InventoryBalanceDTO = IInventoryBalance & {
  _id: string;
  productName?: string;
  lotCode?: string;
  saleUnit?: string;
  expiryDate?: string;
};

export const list = (params?: {
  productId?: string;
  locationId?: string;
}): Promise<ApiResult<{ items: InventoryBalanceDTO[] }>> =>
  request<{ items: InventoryBalanceDTO[] }>("/inventory", { query: params });
