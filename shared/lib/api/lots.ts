import { request, type ApiResult } from "./client";
import type { ILot } from "@/shared/interfaces/mongodb/inventory/lot";
import type { ReceiveLotInput } from "@/shared/schemas/lot";

export type LotDTO = ILot & { _id: string };

export const list = (params?: {
  productId?: string;
  locationId?: string;
}): Promise<ApiResult<{ items: LotDTO[] }>> =>
  request<{ items: LotDTO[] }>("/lots", { query: params });

export const receive = (body: ReceiveLotInput): Promise<ApiResult<LotDTO>> =>
  request<LotDTO>("/lots", { method: "POST", body });
