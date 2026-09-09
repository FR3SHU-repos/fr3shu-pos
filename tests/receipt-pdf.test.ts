import { describe, expect, it } from "vitest";
import { createBuyerReceiptPdf } from "@/shared/lib/receipt-pdf";
import type { BuyerReceiptDetail } from "@/shared/lib/api/receipts";

export const receiptFixture: BuyerReceiptDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  receiptNo: "POS-2026-000001",
  status: "completed",
  totalMinor: 25450,
  subtotalMinor: 26000,
  discountMinor: 550,
  taxMinor: 1212,
  storeName: "KOMOLA Organic Market",
  locationName: "Visakhapatnam",
  customerName: "Test Buyer",
  coinsEarned: 2,
  purchasedAt: "2026-09-09T10:00:00.000Z",
  lines: [
    { name: "Organic Brown Rice", quantity: "2", unit: "kg", unitPriceMinor: 8000, discountMinor: 0, taxMinor: 800, totalMinor: 16000 },
    { name: "Cold Pressed Groundnut Oil", quantity: "1", unit: "litre", unitPriceMinor: 10000, discountMinor: 550, taxMinor: 412, totalMinor: 9450 },
  ],
  payments: [{ method: "upi", amountMinor: 25450, reference: "TEST-REFERENCE" }],
};

describe("buyer receipt PDF", () => {
  it("creates a real PDF document", async () => {
    const pdf = await createBuyerReceiptPdf(receiptFixture);
    const bytes = new Uint8Array(pdf.output("arraybuffer"));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(pdf.getNumberOfPages()).toBe(1);
  });
});
