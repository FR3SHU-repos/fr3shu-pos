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

export const list = (limit = 25): Promise<ApiResult<{ items: BuyerReceiptSummary[] }>> =>
  request("buyer/receipts", { query: { limit } });

export const get = (id: string): Promise<ApiResult<BuyerReceiptDetail>> =>
  request(`buyer/receipts/${encodeURIComponent(id)}`);
