import { goRequest, type ApiResult } from "./client";
import {
  mapSale,
  mapTender,
  type GoRegisterRow,
  type GoSale,
  type GoTender,
  type PaymentDTO,
  type SaleDTO,
} from "./_map";
import type { PageMeta } from "@/app/api/v1/utils/responses";

export type { SaleDTO };
export type PaymentRow = PaymentDTO;

export interface SaleListResult {
  items: SaleDTO[];
  meta: PageMeta;
}

export interface SaleDetail {
  sale: SaleDTO;
  payments: PaymentDTO[];
}

/** Legacy cart payment shape still produced by the POS UI. */
export interface LegacyPayment {
  method: "cash" | "upi" | "card";
  amountPaise: number;
  upiRef?: string;
}

export interface CreateSaleBody {
  idempotencyKey: string;
  sessionId?: string;
  items: Array<{
    productId: string;
    qty: number;
    saleUnit: string;
    lotId?: string;
    discountPaise?: number;
    lotOverrideReason?: string;
  }>;
  payments: LegacyPayment[];
  cartDiscountPaise?: number;
  customerName?: string;
  customerPhone?: string;
  marketingConsent?: boolean;
  deviceId?: string;
}

export const list = async (params?: {
  page?: number;
  limit?: number;
  receiptNo?: string;
  phone?: string;
}): Promise<ApiResult<SaleListResult>> => {
  const res = await goRequest<{ items: GoSale[]; meta: PageMeta }>("sales", { query: params });
  return {
    ...res,
    data: res.data ? { items: res.data.items.map(mapSale), meta: res.data.meta } : null,
  };
};

export const get = async (id: string): Promise<ApiResult<SaleDetail>> => {
  const res = await goRequest<GoSale & { tenders?: GoTender[] }>(`sales/${id}`);
  return {
    ...res,
    data: res.data
      ? {
          sale: mapSale(res.data),
          payments: (res.data.tenders ?? []).map(mapTender),
        }
      : null,
  };
};

/** Maps a legacy cart payment to a provider-neutral canonical tender. */
function toTender(p: LegacyPayment) {
  if (p.method === "cash") return { kind: "cash", amountMinor: p.amountPaise };
  // UPI/card are recorded as a "manual" tender carrying the external reference
  // the cashier confirmed; no gateway response is trusted as proof of payment.
  return {
    kind: "manual",
    amountMinor: p.amountPaise,
    reference: p.upiRef?.trim() || `${p.method}-unref-${Date.now()}`,
    reason: p.method,
  };
}

async function resolveOpenRegisterId(): Promise<string | null> {
  const res = await goRequest<{ items: GoRegisterRow[] }>("registers");
  const row = res.data?.items?.find((r) => r.currentShift && r.currentShift.status === "open");
  return row?.register.id ?? null;
}

export const create = async (
  body: CreateSaleBody,
): Promise<ApiResult<{ sale: SaleDTO; reused: boolean }>> => {
  const registerId = await resolveOpenRegisterId();
  if (!registerId) {
    return {
      success: false,
      message: "No open register session for this store.",
      data: null,
      status: 409,
    };
  }
  const goBody = {
    idempotencyKey: body.idempotencyKey,
    registerId,
    items: body.items.map((i) => ({
      skuId: i.productId,
      qty: String(i.qty),
      unit: i.saleUnit,
      discountMinor: i.discountPaise ?? 0,
      lotId: i.lotId,
      lotOverrideReason: i.lotOverrideReason,
    })),
    tenders: body.payments.map(toTender),
    cartDiscountMinor: body.cartDiscountPaise ?? 0,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
  };
  const res = await goRequest<{ sale: GoSale; reused: boolean }>("sales", {
    method: "POST",
    body: goBody,
    idempotencyKey: body.idempotencyKey,
  });
  return {
    ...res,
    data: res.data ? { sale: mapSale(res.data.sale), reused: res.data.reused } : null,
  };
};

export const voidSale = (
  id: string,
  reason: string,
  idempotencyKey: string,
): Promise<ApiResult<SaleDTO>> =>
  goRequest<GoSale>(`sales/${id}/void`, {
    method: "POST",
    body: { reason, idempotencyKey },
    idempotencyKey,
  }).then((res) => ({ ...res, data: res.data ? mapSale(res.data) : null }));

export const returnSale = (
  id: string,
  body: {
    idempotencyKey: string;
    lines: Array<{ saleLineNo: number; qty: string }>;
    reason: string;
    refundSettlement?: "manual" | "cash" | "pending";
  },
): Promise<ApiResult<unknown>> =>
  goRequest(`sales/${id}/returns`, { method: "POST", body, idempotencyKey: body.idempotencyKey });
