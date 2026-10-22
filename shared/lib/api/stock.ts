import { goRequest, type ApiResult } from "./client";
import { isOffline } from "../offline/products";

export interface AddStockBody {
  /** SKU id (ProductDTO._id). */
  skuId: string;
  /** Quantity in the product's sale unit, as a decimal string (e.g. "30", "1.5"). */
  quantity: string;
  /** Optional batch / harvest label. Auto-generated server-side when blank. */
  lotCode?: string;
  /** Optional expiry / best-before, ISO 8601. */
  expiresAt?: string;
  supplierReference?: string;
}

export interface AddStockResult {
  lotId: string;
  lotCode: string;
  skuId: string;
  unit: string;
  quantity: string;
  expiresAt?: string | null;
}

/** Add a batch of sellable stock for a product. */
export const add = async (body: AddStockBody): Promise<ApiResult<AddStockResult>> => {
  if (isOffline()) {
    return {
      success: false,
      data: null,
      status: 0,
      code: "offline_unavailable",
      message: "Connect to the internet to update stock. Offline stock changes are disabled so inventory stays consistent.",
    };
  }
  return goRequest<AddStockResult>("inventory/receipts", { method: "POST", body });
};
