import { goRequest, type ApiResult } from "./client";
import { refreshOfflineProducts } from "./products";
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
  claimPendingOfflineSales,
  listOfflineSales,
  requeueBlockedOfflineSalesWithAvailableStock,
  requeueRetryableOfflineSales,
  markOfflineSaleSyncState,
  offlineSaleToSyncOperation,
  type OfflineScope,
} from "@/shared/lib/offline/sales";
import { jsonByteLength, recordOfflineSyncAttempt } from "@/shared/lib/offline/network-metrics";

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
  registerId?: string;
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
  walkInCustomer?: boolean;
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
  const registerId = body.registerId ?? await resolveOpenRegisterId();
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
    walkInCustomer: body.walkInCustomer ?? false,
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
  outcome: "accepted" | "already_accepted" | "retry" | "needs_review" | "rejected";
  reason?: string;
  sale?: GoSale;
  inventoryCursor?: string;
  stockAdjustments?: Array<{
    id: string;
    saleId: string;
    operationId: string;
    skuId: string;
    productName?: string;
    shortfallQuantity: string;
    status: string;
  }>;
}

function automaticSyncMessage(reason?: string): string {
  switch (reason) {
    case "auth_required":
      return "Sign in again before syncing this sale.";
    case "invalid_operation":
      return "Automatic check failed: sale data is incomplete.";
    case "invalid_cash":
      return "Automatic check failed: cash paid, total, or change does not match.";
    case "invalid_line":
      return "Automatic check failed: one product line is incomplete.";
    case "invalid_totals":
      return "Automatic check failed: item totals do not match the sale total.";
    case "invalid_occurred_at":
      return "Automatic check failed: sale time is invalid.";
    case "inventory_cursor_missing":
      return "Offline catalogue evidence is incomplete. Refresh the catalogue before syncing.";
    case "inventory_cursor_invalid":
      return "Offline inventory evidence is invalid. Export the receipt and ask support to review it.";
    case "offline_lot_evidence_missing":
      return "Offline lot evidence is missing. Refresh stock before syncing this sale.";
    case "offline_lot_evidence_invalid":
      return "Offline lot evidence is invalid. Export the receipt and ask support to review it.";
    case "validation":
      return "Automatic check failed on the server. Check customer, stock, product, and cash details.";
    case "conflict":
      return "Automatic check failed: server stock or register state conflicts with this sale.";
    case "operation_conflict":
      return "Review required: this operation ID was already used with different sale details.";
    case "shift_closed":
      return "Review required: the register shift is closed. Keep the local receipt and ask a manager to reconcile this sale.";
    case "catalogue_snapshot_missing":
      return "Review required: this sale does not contain a trusted catalogue snapshot.";
    case "catalogue_effective_at_invalid":
      return "Review required: the saved catalogue timestamp is invalid.";
    case "unsupported_pricing_policy":
      return "Review required: this sale was calculated with an unsupported pricing policy.";
    case "catalogue_item_unavailable":
      return "Review required: one product is no longer available at this location.";
    case "catalogue_unit_changed":
      return "Review required: one product's sale unit changed after this sale was recorded.";
    case "stale_price":
      return "Review required: one product's price changed after this sale was recorded.";
    case "stale_tax":
      return "Review required: one product's tax rule changed after this sale was recorded.";
    case "offline_line_arithmetic_mismatch":
      return "Review required: one offline line total does not match the saved price, quantity, discount, and tax evidence.";
    case "inventory_conflict":
      return "Review required: server inventory or lot availability differs from this offline sale.";
    case "offline_authorization_expired":
      return "Offline authorization expired or was revoked. Prepare this register online before retrying.";
    case "server_error":
      return "Server could not complete sync. The sale will retry automatically.";
    default:
      return reason ? `Automatic check failed: ${reason}.` : "Automatic check failed. This sale was not synced.";
  }
}

function retryDelayMs(sale: { syncAttempts?: number }, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return Math.min(15 * 60_000, Math.max(1_000, retryAfterMs));
  const attempt = Math.max(1, sale.syncAttempts ?? 1);
  const base = Math.min(15 * 60_000, 1_000 * (2 ** Math.min(attempt - 1, 10)));
  return Math.round(base * (0.875 + Math.random() * 0.25));
}

export async function syncPendingOfflineSales(scope: OfflineScope, options: { forceRetry?: boolean } = {}): Promise<{
  attempted: number;
  synced: number;
  blocked: number;
  authRequired: boolean;
  unavailable?: boolean;
  message?: string;
  blockedMessages?: string[];
}> {
  const empty = { attempted: 0, synced: 0, blocked: 0, authRequired: false, blockedMessages: [] };
  if (options.forceRetry) await requeueRetryableOfflineSales(scope);
  const localSales = await listOfflineSales(scope);
  const hasLocalSyncWork = localSales.some((sale) => ["pending", "uploading", "retry_wait", "auth_required", "blocked", "needs_review"].includes(sale.syncState));
  if (!hasLocalSyncWork) return empty;
  const refreshed = await refreshOfflineProducts();
  if (refreshed) await requeueBlockedOfflineSalesWithAvailableStock(scope, refreshed.items, refreshed.savedAt);
  const pending = await claimPendingOfflineSales(scope, 10);
  if (pending.length === 0) return empty;
  const batch = pending.slice(0, 10);
  const startedAt = Date.now();
  const syncPayload = { operations: batch.map(offlineSaleToSyncOperation) };
  const res = await goRequest<{ results: OfflineSaleSyncResult[] }>("sync/sales", {
    method: "POST",
    body: syncPayload,
    idempotencyKey: `offline-sync:${batch.map((sale) => sale.operationId).join(",")}`,
  });
  recordOfflineSyncAttempt(Date.now() - startedAt, jsonByteLength(syncPayload), !res.success || res.data?.results?.some((result) => result.outcome === "retry") === true);
  if (res.status === 401 || res.status === 403) {
    await Promise.all(batch.map((sale) => markOfflineSaleSyncState(scope, sale.operationId, "auth_required", { message: "Sign in again before syncing this sale." })));
    return { attempted: batch.length, synced: 0, blocked: 0, authRequired: true };
  }
  if (res.status === 404) {
    await Promise.all(batch.map((sale) => incrementOfflineSaleAttempt(
      scope,
      sale.operationId,
      retryDelayMs(sale, res.retryAfterMs),
      res.message || "The backend sync endpoint is unavailable. The sale will retry automatically.",
    )));
    return {
      attempted: batch.length,
      synced: 0,
      blocked: 0,
      authRequired: false,
      unavailable: true,
      message: "The backend sync endpoint is not available. Restart or update the Go API, then try Sync again.",
      blockedMessages: [],
    };
  }
  if (!res.success || !res.data) {
    await Promise.all(batch.map((sale) => incrementOfflineSaleAttempt(
      scope,
      sale.operationId,
      retryDelayMs(sale, res.retryAfterMs),
      res.message || "Offline sale sync did not complete. The sale will retry automatically.",
    )));
    return {
      attempted: batch.length,
      synced: 0,
      blocked: 0,
      authRequired: false,
      message: res.message || "Offline sale sync did not complete.",
      blockedMessages: [],
    };
  }
  let synced = 0;
  let blocked = 0;
  let authRequired = false;
  const blockedMessages: string[] = [];
  const accepted: Array<{ operationId: string; message: string; serverSaleId?: string; serverReceiptNo?: string; serverInventoryCursor?: string }> = [];
  for (const result of res.data.results ?? []) {
    if (result.outcome === "accepted" || result.outcome === "already_accepted") {
      const adjustmentMessage = result.stockAdjustments?.length
        ? ` ${result.stockAdjustments.length} stock adjustment${result.stockAdjustments.length === 1 ? "" : "s"} require review.`
        : "";
      if (await markOfflineSaleSyncState(scope, result.operationId, "synced", {
        message: result.sale?.receiptNo
          ? `Synced to the server as ${result.sale.receiptNo}.${adjustmentMessage}`
          : result.outcome === "already_accepted" ? `Already accepted by the server.${adjustmentMessage}` : `Synced to the server.${adjustmentMessage}`,
        serverSaleId: result.sale?.id,
        serverReceiptNo: result.sale?.receiptNo,
        serverInventoryCursor: result.inventoryCursor,
      })) synced += 1;
      accepted.push({
        operationId: result.operationId,
        message: result.sale?.receiptNo
          ? `Synced to the server as ${result.sale.receiptNo}.${adjustmentMessage}`
          : result.outcome === "already_accepted" ? `Already accepted by the server.${adjustmentMessage}` : `Synced to the server.${adjustmentMessage}`,
        serverSaleId: result.sale?.id,
        serverReceiptNo: result.sale?.receiptNo,
        serverInventoryCursor: result.inventoryCursor,
      });
    } else if (result.reason === "auth_required") {
      authRequired = true;
      await markOfflineSaleSyncState(scope, result.operationId, "auth_required", { message: "Sign in again before syncing this sale." });
    } else if (result.outcome === "rejected" || result.outcome === "needs_review") {
      blocked += 1;
      const message = automaticSyncMessage(result.reason);
      blockedMessages.push(message);
      await markOfflineSaleSyncState(scope, result.operationId, result.outcome === "needs_review" ? "needs_review" : "blocked", { message });
    } else {
      const sale = batch.find((item) => item.operationId === result.operationId);
      await incrementOfflineSaleAttempt(scope, result.operationId, retryDelayMs(sale ?? {}, res.retryAfterMs), automaticSyncMessage(result.reason));
    }
  }
  if (accepted.length > 0) {
    const postSyncCatalogue = await refreshOfflineProducts(undefined, { force: true });
    if (postSyncCatalogue) {
      await Promise.all(accepted.map((item) => markOfflineSaleSyncState(scope, item.operationId, "synced", {
        message: item.message,
        serverSaleId: item.serverSaleId,
        serverReceiptNo: item.serverReceiptNo,
        serverInventoryCursor: item.serverInventoryCursor,
        inventoryCoveredAt: postSyncCatalogue.effectiveAt,
      })));
    }
  }
  return { attempted: batch.length, synced, blocked, authRequired, blockedMessages };
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
