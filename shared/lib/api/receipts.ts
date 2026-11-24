import { request, type ApiResult } from "./client";

export interface BuyerReceiptSummary {
  id: string;
  receiptNo: string;
  status: string;
  totalMinor: number;
  storeName: string;
  locationName: string;
  coinsEarned: number;
  purchasedAt: string;
}

export interface BuyerReceiptLine {
  name: string;
  quantity: string;
  unit: string;
  unitPriceMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface BuyerReceiptDetail extends BuyerReceiptSummary {
  issue?: ReceiptIssue;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  customerName: string;
  lines: BuyerReceiptLine[];
  payments: Array<{ method: string; amountMinor: number; reference?: string }>;
}

export type ReceiptIssueReason = "wrong_amount" | "items_wrong" | "not_my_bill" | "other";
export type ReceiptIssue = {
  id: string;
  reason: ReceiptIssueReason;
  status: "open" | "resolved" | "dismissed";
};
export type ReceiptMatches = {
  verifiedPhone: boolean;
  linkedCount: number;
  pendingCount: number;
  storeCount: number;
};

export const matches = () => request<ReceiptMatches>("buyer/receipt-matches");
export const decline = (id: string) =>
  request(`buyer/receipt-claims/${encodeURIComponent(id)}/decline`, { method: "POST", body: {} });
export const reportIssue = (id: string, reason: ReceiptIssueReason, note: string) =>
  request<ReceiptIssue>(`buyer/receipts/${encodeURIComponent(id)}/issues`, {
    method: "POST",
    body: { reason, note: note.trim() || undefined },
  });

export interface ReceiptClaimCandidate {
  id: string;
  receiptNo: string;
  totalMinor: number;
  storeName: string;
  locationName: string;
  purchasedAt: string;
}

export interface ReceiptPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const list = (
  limit = 25,
  page = 1,
): Promise<ApiResult<{ items: BuyerReceiptSummary[]; meta: ReceiptPageMeta }>> =>
  request("buyer/receipts", { query: { page, limit } });

export const get = (id: string): Promise<ApiResult<BuyerReceiptDetail>> =>
  request(`buyer/receipts/${encodeURIComponent(id)}`);

export const claimable = (): Promise<ApiResult<{ items: ReceiptClaimCandidate[] }>> =>
  request("buyer/receipt-claims");

export const claim = (id: string): Promise<ApiResult<BuyerReceiptDetail>> =>
  request(`buyer/receipt-claims/${encodeURIComponent(id)}/claim`, { method: "POST" });
