import { describe, expect, it } from "vitest";
import { authIntent, destinationForCapabilities } from "@/shared/lib/auth/intent";

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
});
