import { describe, expect, it } from "vitest";
import { authIntent, destinationForCapabilities, isBuyerExperiencePath } from "@/shared/lib/auth/intent";

describe("shared authentication intent", () => {
  it("uses one account while routing to the selected experience", () => {
    expect(authIntent("buyer")).toBe("buyer");
    expect(destinationForCapabilities("buyer", { buyer: true, seller: true })).toBe("/buyer");
    expect(destinationForCapabilities("seller", { buyer: true, seller: true })).toBe("/dashboard");
  });

  it("routes missing capabilities to onboarding", () => {
    expect(destinationForCapabilities("buyer", { buyer: false, seller: true })).toBe("/buyer/setup");
    expect(destinationForCapabilities("seller", { buyer: true, seller: false })).toBe("/seller/onboarding");
  });

  it("keeps buyer pages out of seller onboarding guards", () => {
    expect(isBuyerExperiencePath("/buyer")).toBe(true);
    expect(isBuyerExperiencePath("/buyer/setup")).toBe(true);
    expect(isBuyerExperiencePath("/dashboard")).toBe(false);
  });
});
