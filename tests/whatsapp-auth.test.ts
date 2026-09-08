import { describe,expect,it } from "vitest";
import { maskedPhone,normalizeIndianWhatsApp,validOtp } from "@/shared/lib/auth/whatsapp";

describe("WhatsApp authentication input",()=>{
  it("normalizes valid Indian mobile numbers",()=>{expect(normalizeIndianWhatsApp("98765 43210")).toBe("+919876543210");expect(normalizeIndianWhatsApp("+91-98765-43210")).toBe("+919876543210")});
  it("rejects malformed numbers",()=>{expect(normalizeIndianWhatsApp("1234567890")).toBeNull();expect(normalizeIndianWhatsApp("+447700900123")).toBeNull()});
  it("validates OTPs and masks destinations",()=>{expect(validOtp("123456")).toBe(true);expect(validOtp("12345")).toBe(false);expect(maskedPhone("+919876543210")).toBe("+91 •••••• 3210")});
});
