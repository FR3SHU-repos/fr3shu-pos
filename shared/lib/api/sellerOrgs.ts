/**
 * Typed client for POS seller onboarding and tenancy.
 *
 * These endpoints live on go-api-backend and are authenticated with the
 * Supabase access token (Bearer), NOT the POS `pos_token` cookie — so they go
 * through `request()` (direct to the Go service) rather than `goRequest()` (the
 * same-origin `/api/v1/pos/*` cookie proxy). This module performs no database
 * access; the Go service owns every write.
 *
 * Backend contract: `docs/pos-architecture.md` in go-api-backend.
 */

import { request, type ApiResult } from "./client";

export type SellerOrgType = "Farmer" | "FPO" | "Retailer" | "Brand";
export type SellerOrgStatus = "Pending" | "Approved" | "Suspended";
export type OnboardingState = "provisioning" | "linked" | "complete";
export type MembershipRole = "Owner" | "Manager" | "Cashier" | "InventoryManager";

export interface SellerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface SellerOrganization {
  id: string;
  legalName: string;
  displayName: string;
  type: SellerOrgType;
  status: SellerOrgStatus;
  ownerUserId: string;
  phoneE164?: string;
  whatsappPhoneE164?: string;
  gstin?: string;
  billingAddress?: SellerAddress;
  onboardingState: OnboardingState;
  createdAt: string;
  updatedAt: string;
}

export interface PosLocation {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  address?: SellerAddress;
  timezone?: string;
  phoneE164?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  roles: MembershipRole[];
  locationIds: string[];
  status: "active" | "invited" | "suspended";
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Request body for `POST /api/v1/seller-organizations`. No role/status field. */
export interface RegisterSellerBody {
  organization: {
    legalName: string;
    displayName?: string;
    type: SellerOrgType;
    phoneE164?: string;
    whatsappPhoneE164?: string;
    gstin?: string;
    billingAddress?: SellerAddress;
  };
  location: CreateLocationBody;
}

export interface CreateLocationBody {
  code: string;
  name: string;
  timezone?: string;
  phoneE164?: string;
  address?: SellerAddress;
}

export interface OnboardingResult {
  organization: SellerOrganization;
  location?: PosLocation;
  membership?: OrganizationMembership;
  created: boolean;
  reused: boolean;
}

export interface MyOrganization {
  organization: SellerOrganization;
  locations: PosLocation[];
  membership: OrganizationMembership | null;
}

/**
 * Register the current Supabase user as a seller: creates the organization
 * (status `Pending`), its first location, and an Owner membership, then links
 * the org to the canonical user. Idempotent — calling again returns the
 * existing organization (`reused: true`).
 *
 * A `202` with `code === "onboarding_link_pending"` means the organization was
 * created but the canonical-user link did not finish; call `registerSeller`
 * again with the same body to complete it.
 */
export function registerSeller(
  body: RegisterSellerBody,
  idempotencyKey?: string,
): Promise<ApiResult<OnboardingResult>> {
  return request<OnboardingResult>("seller-organizations", {
    method: "POST",
    body,
    idempotencyKey,
  });
}

/** The caller's organization, its locations, and their membership. 404 if none. */
export function getMyOrganization(): Promise<ApiResult<MyOrganization>> {
  return request<MyOrganization>("seller-organizations/me");
}

/** Add a POS location to an organization the caller owns or manages. */
export function createLocation(
  organizationId: string,
  body: CreateLocationBody,
): Promise<ApiResult<PosLocation>> {
  return request<PosLocation>(
    `seller-organizations/${encodeURIComponent(organizationId)}/locations`,
    { method: "POST", body },
  );
}

/** List an organization's POS locations (any member). */
export function listLocations(
  organizationId: string,
): Promise<ApiResult<{ items: PosLocation[] }>> {
  return request<{ items: PosLocation[] }>(
    `seller-organizations/${encodeURIComponent(organizationId)}/locations`,
  );
}

/** True when the onboarding response asks the caller to retry the link step. */
export function isLinkPending(res: ApiResult<unknown>): boolean {
  return res.status === 202 || res.code === "onboarding_link_pending";
}
