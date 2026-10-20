import { describe, expect, it } from "vitest";
import {
  buyerCampaignsReady,
  buyerProfileReady,
  missingBuyerCampaignDetails,
} from "@/shared/lib/buyer/profile";
import type { PersonProfile } from "@/shared/lib/api/identity";

const profile = (overrides: Partial<PersonProfile> = {}): PersonProfile => ({
  id: "person-1",
  displayName: "Buyer",
  status: "active",
  buyer: true,
  contacts: [
    {
      id: "phone-1",
      type: "phone",
      value: "+919876543210",
      verified: true,
      verifiedAt: null,
      primary: true,
      source: "test",
    },
  ],
  locationCode: "visakhapatnam",
  ...overrides,
});

describe("buyer profile readiness", () => {
  it("allows offer discovery before a delivery address is complete", () => {
    const buyer = profile();

    expect(buyerCampaignsReady(buyer)).toBe(true);
    expect(buyerProfileReady(buyer)).toBe(false);
  });

  it("reports only the fields required to discover offers", () => {
    expect(
      missingBuyerCampaignDetails(
        profile({ displayName: "", locationCode: undefined, contacts: [] }),
      ),
    ).toEqual(["your name", "mobile number", "buyer location"]);
  });
});
