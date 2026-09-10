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
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  customerName: string;
  lines: BuyerReceiptLine[];
  payments: Array<{ method: string; amountMinor: number; reference?: string }>;
}

export interface ReceiptPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const list = (limit = 25, page = 1): Promise<ApiResult<{ items: BuyerReceiptSummary[]; meta: ReceiptPageMeta }>> =>
  request("buyer/receipts", { query: { page, limit } });

export const get = (id: string): Promise<ApiResult<BuyerReceiptDetail>> =>
  request(`buyer/receipts/${encodeURIComponent(id)}`);
