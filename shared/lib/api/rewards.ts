import { goRequest, type ApiResult } from "./client";

export interface RewardSummary {
  availableCoins: number;
  pendingCoins: number;
  lifetimeEarnedCoins: number;
  lifetimeRedeemedCoins: number;
  reversedCoins: number;
  eligibleRemainderMinor: number;
  verifiedPurchaseCount: number;
  eligibleSpendMinor: number;
}

export interface RewardLedgerEntry {
  id: string;
  sourceType: "verified_sale" | "refund" | "void" | "bonus" | "redemption" | "redemption_reversal" | "admin_adjustment";
  sourceTransactionId: string;
  coinAmount: number;
  eligibleAmountMinor: number;
  status: "pending" | "available" | "reversed" | "redeemed";
  policyCode: string;
  policyVersion: number;
  reversalOfId?: string;
  reason: string;
  createdAt: string;
  effectiveAt: string;
}

export interface RewardLedgerPage { items: RewardLedgerEntry[]; nextCursor?: string }

export const summary = (): Promise<ApiResult<RewardSummary>> => goRequest("buyer/rewards/summary");
export const ledger = (cursor?: string, limit = 10): Promise<ApiResult<RewardLedgerPage>> =>
  goRequest("buyer/rewards/ledger", { query: { cursor, limit } });
