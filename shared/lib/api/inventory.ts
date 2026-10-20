import { goRequest, type ApiResult } from "./client";
import { unitFactor } from "./_map";
import { isOffline, readProducts } from "../offline/products";

export interface InventoryBalanceDTO {
  _id: string;
  productId: string;
  productName?: string;
  lotId?: string;
  lotCode?: string;
  saleUnit?: string;
  availableBase: number;
  expiryDate?: string;
}

export interface OfflineStockAdjustmentDTO {
  id: string;
  saleId: string;
  operationId: string;
  skuId: string;
  productName?: string;
  serverQuantityBefore: number;
  requestedQuantity: number;
  allocatedQuantity: number;
  shortfallQuantity: number;
  inventoryCursor: string;
  status: string;
  createdAt: string;
}

interface GoInvRow {
  skuId: string;
  skuCode: string;
  name: string;
  productId: string;
  unit: string;
  availableQty: string;
  lots: Array<{ lotId?: string; lotCode?: string; qty: string; expiresAt?: string }>;
}

/** Flattens the Go per-SKU sellable projection into per-lot balance rows. */
export const list = async (params?: {
  productId?: string;
  locationId?: string;
}): Promise<ApiResult<{ items: InventoryBalanceDTO[] }>> => {
  if (isOffline()) {
    const snapshot = await readProducts();
    if (!snapshot) return { success: false, data: null, status: 0, code: "offline_unavailable", message: "No saved stock data is available on this device." };
    const items = snapshot.items.flatMap((product) => (product.lots ?? []).map((lot) => ({
      _id: `${product._id}:${lot.lotId}`,
      productId: product._id,
      productName: product.name,
      lotId: lot.lotId,
      lotCode: lot.lotCode,
      saleUnit: product.saleUnit,
      availableBase: Math.round(lot.qty * product.basePerSaleUnit),
      expiryDate: lot.expiresAt,
    })));
    return { success: true, data: { items }, status: 200, code: "offline_cache", message: "Showing stock saved on this device." };
  }
  const res = await goRequest<{ items: GoInvRow[] }>("inventory", {
    query: { skuId: params?.productId },
  });
  if (!res.data) return { ...res, data: null };
  const items: InventoryBalanceDTO[] = [];
  for (const row of res.data.items) {
    const factor = unitFactor(row.unit);
    for (const lot of row.lots ?? []) {
      items.push({
        _id: `${row.skuId}:${lot.lotId ?? "none"}`,
        productId: row.skuId,
        productName: row.name || row.skuCode,
        lotId: lot.lotId,
        lotCode: lot.lotCode,
        saleUnit: row.unit,
        availableBase: Math.round(Number(lot.qty || 0) * factor),
        expiryDate: lot.expiresAt,
      });
    }
  }
  return { ...res, data: { items } };
};

export const offlineAdjustments = (): Promise<ApiResult<{ items: OfflineStockAdjustmentDTO[] }>> =>
  goRequest<{ items: OfflineStockAdjustmentDTO[] }>("inventory/offline-adjustments");
