import { request, type ApiResult } from "./client";

export type BuyerFulfillmentMethod =
  "home_delivery" | "store_pickup" | "online_redemption";
export type BuyerApprovalMode = "automatic" | "manual";

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
  approvalMode: BuyerApprovalMode;
  deliveryOptions: BuyerFulfillmentMethod[];
  pickupStoreName: string | null;
  pickupStorePhone: string | null;
  pickupStoreAddress: Record<string, string>;
  buyerProfile?: {
    name: string;
    phone: string;
    address: Record<string, string>;
  };
  buyerClaim?: BuyerCampaignClaim | null;
};

export type BuyerCampaignClaim = {
  id: string;
  claimCode: string;
  status: "claimed" | "approved" | "redeemed" | "cancelled";
  claimedAt: string;
  points: number;
  fulfillmentMethod: BuyerFulfillmentMethod;
  buyerName: string;
  buyerPhone: string;
  deliveryAddress: Record<string, string>;
  pickupStoreName: string | null;
  pickupStorePhone: string | null;
  pickupStoreAddress: Record<string, string>;
  campaign: BuyerCampaign;
};

export type BuyerRewardClaim = {
  id: string;
  claimCode: string;
  status: "claimed" | "approved" | "redeemed";
  claimedAt: string;
  approvedAt: string | null;
  redeemedAt: string | null;
  points: number;
  fulfillmentMethod: BuyerFulfillmentMethod;
  deliveryAddress: Record<string, string>;
  pickupStoreName: string | null;
  pickupStorePhone: string | null;
  pickupStoreAddress: Record<string, string>;
  campaign: {
    id: string;
    slug: string;
    title: string;
    description: string;
    imageUrl: string;
    providerName: string;
    locationName: string;
    approvalMode: BuyerApprovalMode;
  };
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

export const wallet = (): Promise<ApiResult<{ items: BuyerRewardClaim[] }>> =>
  request("buyer/reward-claims");
