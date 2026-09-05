import { goRequest, type ApiResult } from "./client";

export interface LotDTO {
  _id: string;
  lotCode: string;
  producerName?: string;
  expiryDate?: string;
  certificationSnapshot?: { isVerifiedOrganic?: boolean };
  skuId?: string;
}

interface GoLotRow {
  skuId: string;
  lotId?: string;
  lotCode?: string;
  qty: string;
  expiresAt?: string;
}

export const list = async (params?: {
  productId?: string;
  locationId?: string;
}): Promise<ApiResult<{ items: LotDTO[] }>> => {
  const res = await goRequest<{ items: GoLotRow[] }>("inventory/lots", {
    query: { skuId: params?.productId },
  });
  return {
    ...res,
    data: res.data
      ? {
          items: res.data.items.map((l) => ({
            _id: l.lotId ?? `${l.skuId}:${l.lotCode ?? "none"}`,
            lotCode: l.lotCode ?? "—",
            expiryDate: l.expiresAt,
            skuId: l.skuId,
          })),
        }
      : null,
  };
};

export const receive = async (_body?: unknown): Promise<ApiResult<LotDTO>> => ({
  success: false,
  message: "Lot receiving is handled in the warehouse app; POS reads canonical inventory only.",
  data: null,
  status: 501,
});
