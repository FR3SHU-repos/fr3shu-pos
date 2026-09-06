import { describe, expect, it } from "vitest";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";

describe("post-auth role routing", () => {
  it("routes an Admin without requiring a seller organization", () => {
    expect(isPlatformAdmin({ role: "Admin" })).toBe(true);
    expect(ADMIN_HOME).toBe("/admin/seller-applications");
  });

  it("keeps seller roles in the seller routing flow", () => {
    expect(isPlatformAdmin({ role: "SellerOwner" })).toBe(false);
    expect(isPlatformAdmin({ role: "StoreOwner" })).toBe(false);
  });
});
