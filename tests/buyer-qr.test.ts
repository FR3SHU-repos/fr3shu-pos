import { describe, expect, it } from "vitest";
import { extractBuyerCode } from "@/shared/components/pos/BuyerQrScanner";

describe("buyer QR payload", () => {
  it("accepts and normalizes a KOMOLA buyer code", () => {
    expect(extractBuyerCode("byr-2738ac942b")).toBe("BYR-2738AC942B");
  });

  it("extracts a buyer code from a shared URL", () => {
    expect(extractBuyerCode("https://pos.komola.in/buyer/BYR-2738AC942B")).toBe("BYR-2738AC942B");
  });

  it("rejects unrelated QR payloads", () => {
    expect(extractBuyerCode("https://example.com/payment")).toBeNull();
  });
});
