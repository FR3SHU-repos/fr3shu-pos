import { describe, expect, it } from "vitest";
import { googleAuthEnabled, sellerGoogleRedirect, whatsappAuthEnabled } from "@/shared/lib/auth/providers";

describe("seller auth providers", () => {
  it("gates Google strictly on the public flag", () => {
    expect(googleAuthEnabled("true")).toBe(true);
    expect(googleAuthEnabled("false")).toBe(false);
    expect(googleAuthEnabled(undefined)).toBe(false);
  });
  it("keeps WhatsApp disabled until Supabase session issuance is approved", () => {
    expect(whatsappAuthEnabled()).toBe(false);
  });
  it("constructs the fixed seller callback without accepting a next URL", () => {
    expect(sellerGoogleRedirect("https://pos.komola.in")).toBe("https://pos.komola.in/auth/callback?intent=seller-register");
  });
});
