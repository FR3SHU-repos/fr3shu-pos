import { describe, expect, it } from "vitest";
import { authIntent, destinationForCapabilities, isBuyerExperiencePath } from "@/shared/lib/auth/intent";

describe("shared authentication intent", () => {
  it("routes existing accounts by their stored category", () => {
    expect(authIntent("buyer")).toBe("buyer");
    expect(destinationForCapabilities("buyer", { buyer: false, seller: true })).toBe("/dashboard");
    expect(destinationForCapabilities("seller", { buyer: true, seller: false })).toBe("/buyer");
    expect(destinationForCapabilities("seller", { buyer: true, seller: true })).toBe("/dashboard");
  });

  it("uses the selected category only for a new account", () => {
    expect(destinationForCapabilities("buyer", { buyer: false, seller: false })).toBe("/buyer/setup");
    expect(destinationForCapabilities("seller", { buyer: false, seller: false })).toBe("/seller/onboarding");
  });

  it("keeps buyer pages out of seller onboarding guards", () => {
    expect(isBuyerExperiencePath("/buyer")).toBe(true);
    expect(isBuyerExperiencePath("/buyer/setup")).toBe(true);
    expect(isBuyerExperiencePath("/dashboard")).toBe(false);
  });
});
