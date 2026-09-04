import { request, type ApiResult } from "./client";
import type { ISale } from "@/shared/interfaces/mongodb/pos/sale";
import type { IPayment } from "@/shared/interfaces/mongodb/pos/payment";
import type { CreateSaleInput } from "@/shared/schemas/sale";
import type { PageMeta } from "@/app/api/v1/utils/responses";

export type SaleDTO = ISale & { _id: string };

export interface SaleListResult {
  items: SaleDTO[];
  meta: PageMeta;
}

export interface SaleDetail {
  sale: SaleDTO;
  payments: (IPayment & { _id: string })[];
}

export const list = (params?: {
  page?: number;
  limit?: number;
  receiptNo?: string;
  phone?: string;
}): Promise<ApiResult<SaleListResult>> =>
  request<SaleListResult>("/sales", { query: params });

export const get = (id: string): Promise<ApiResult<SaleDetail>> =>
  request<SaleDetail>(`/sales/${id}`);

/** `reused` is true when the idempotency key matched an existing sale. */
export const create = (
  body: CreateSaleInput,
): Promise<ApiResult<{ sale: SaleDTO; reused: boolean }>> =>
  request<{ sale: SaleDTO; reused: boolean }>("/sales", { method: "POST", body });
