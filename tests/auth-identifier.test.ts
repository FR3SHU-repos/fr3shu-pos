import { describe, expect, it } from "vitest";
import { normalizeAuthIdentifier } from "@/shared/lib/auth/identifier";

describe("normalizeAuthIdentifier", () => {
  it("uses an Indian mobile number as a phone credential", () => {
    expect(normalizeAuthIdentifier("98765 43210")).toEqual({
      kind: "phone",
      value: "+919876543210",
    });
  });

  it("normalizes email credentials without changing their meaning", () => {
    expect(normalizeAuthIdentifier("  User@Example.COM ")).toEqual({
      kind: "email",
      value: "user@example.com",
    });
  });
});
