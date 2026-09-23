import { request, type ApiResult } from "./client";

export type BuyerCampaign = {
  id: string;
  slug: string;
  title: string;
  description: string;
  campaignType: "product" | "offer" | "online_cashback";
  rewardType: "fixed_points" | "bonus_points" | "points_multiplier";
  points: number;
  totalClaimsAllowed: number;
  perBuyerLimit: number;
  timerEnabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string;
  status: "published";
  claims: number;
  claimsRemaining: number;
  buyerClaims: number;
  buyerClaimsRemaining: number;
  locationCode: string;
  locationName: string;
  providerName: string;
};

export type BuyerCampaignClaim = {
  id: string;
  claimCode: string;
  status: "claimed" | "redeemed" | "cancelled";
  claimedAt: string;
  campaign: BuyerCampaign;
};

export const list = (): Promise<ApiResult<{ items: BuyerCampaign[] }>> =>
  request("buyer/reward-campaigns");

export const get = (id: string): Promise<ApiResult<BuyerCampaign>> =>
  request(`buyer/reward-campaigns/${encodeURIComponent(id)}`);

export const claim = (id: string): Promise<ApiResult<BuyerCampaignClaim>> =>
  request(`buyer/reward-campaigns/${encodeURIComponent(id)}/claim`, {
    method: "POST",
    body: {},
    idempotencyKey: crypto.randomUUID(),
  });
