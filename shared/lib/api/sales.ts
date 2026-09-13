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
import {
  incrementOfflineSaleAttempt,
  listPendingOfflineSales,
  markOfflineSaleSyncState,
  offlineSaleToSyncOperation,
  type OfflineScope,
} from "@/shared/lib/offline/sales";

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
  buyerCode?: string;
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
function toTender(p: LegacyPayment, stableReference: string) {
  if (p.method === "cash") return { kind: "cash", amountMinor: p.amountPaise };
  // UPI/card are recorded as a "manual" tender carrying the external reference
  // the cashier confirmed; no gateway response is trusted as proof of payment.
  return {
    kind: "manual",
    amountMinor: p.amountPaise,
    reference: p.upiRef?.trim() || `${p.method}-${stableReference}`,
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
    tenders: body.payments.map((p, index) => toTender(p, `${body.idempotencyKey}-${index}`)),
    cartDiscountMinor: body.cartDiscountPaise ?? 0,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    buyerCode: body.buyerCode,
    marketingConsent: body.marketingConsent ?? false,
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

export interface OfflineSaleSyncResult {
  operationId: string;
  outcome: "accepted" | "already_accepted" | "needs_review" | "rejected";
  reason?: string;
  sale?: GoSale;
}

export async function syncPendingOfflineSales(scope: OfflineScope): Promise<{
  attempted: number;
  synced: number;
  review: number;
  authRequired: boolean;
}> {
  const pending = await listPendingOfflineSales(scope);
  if (pending.length === 0) return { attempted: 0, synced: 0, review: 0, authRequired: false };
  const batch = pending.slice(0, 10);
  const res = await goRequest<{ results: OfflineSaleSyncResult[] }>("sync/sales", {
    method: "POST",
    body: { operations: batch.map(offlineSaleToSyncOperation) },
    idempotencyKey: `offline-sync:${batch.map((sale) => sale.operationId).join(",")}`,
  });
  if (res.status === 401 || res.status === 403) {
    await Promise.all(batch.map((sale) => markOfflineSaleSyncState(scope, sale.operationId, "auth_required")));
    return { attempted: batch.length, synced: 0, review: 0, authRequired: true };
  }
  if (!res.success || !res.data) {
    await Promise.all(batch.map((sale) => incrementOfflineSaleAttempt(scope, sale.operationId, 60_000)));
    return { attempted: batch.length, synced: 0, review: 0, authRequired: false };
  }
  let synced = 0;
  let review = 0;
  let authRequired = false;
  for (const result of res.data.results ?? []) {
    if (result.outcome === "accepted" || result.outcome === "already_accepted") {
      if (await markOfflineSaleSyncState(scope, result.operationId, "synced")) synced += 1;
    } else if (result.reason === "auth_required") {
      authRequired = true;
      await markOfflineSaleSyncState(scope, result.operationId, "auth_required");
    } else {
      review += 1;
      await markOfflineSaleSyncState(scope, result.operationId, "needs_review");
    }
  }
  return { attempted: batch.length, synced, review, authRequired };
}

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
