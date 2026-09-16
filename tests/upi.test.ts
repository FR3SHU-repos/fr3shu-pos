import { describe, expect, it } from "vitest";
import { buildUpiPaymentUri, isValidUpiId } from "@/shared/lib/upi";

describe("UPI payment links", () => {
  it("builds an amount-specific INR payment URI", () => {
    const uri = buildUpiPaymentUri({ upiId: "seller@bank", payeeName: "Organic Stall", amountPaise: 13050, note: "KOMOLA sale" });
    expect(uri).toContain("pa=seller%40bank");
    expect(uri).toContain("pn=Organic+Stall");
    expect(uri).toContain("am=130.50");
    expect(uri).toContain("cu=INR");
  });

  it("rejects invalid UPI IDs and amounts", () => {
    expect(isValidUpiId("not-an-id")).toBe(false);
    expect(() => buildUpiPaymentUri({ upiId: "bad", payeeName: "", amountPaise: 100 })).toThrow();
    expect(() => buildUpiPaymentUri({ upiId: "seller@bank", payeeName: "", amountPaise: 0 })).toThrow();
  });
});
