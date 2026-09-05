import { goRequest, type ApiResult } from "./client";
import { unitFactor } from "./_map";

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
