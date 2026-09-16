import { describe, expect, it } from "vitest";
import { buildWhatsAppReceiptUrl } from "@/shared/lib/whatsapp-share";
import type { SaleDTO } from "@/shared/lib/api/sales";

const sale: SaleDTO = {
  _id: "sale-1",
  receiptNo: "POS-2026-000001",
  status: "completed",
  items: [{
    productId: "p-1", lotId: "l-1", name: "Tomatoes", sku: "TOM",
    saleUnit: "kg", qtyBase: 1500, basePerSaleUnit: 1000,
    unitPricePaise: 8000, grossPaise: 12000, discountPaise: 0,
    taxRateBps: 0, taxPaise: 0, netPaise: 12000,
  }],
  grossPaise: 12000, discountPaise: 0, taxPaise: 0, totalPaise: 12000,
  customerPhone: "+91 98765 43210", cashierId: "u-1", registerId: "r-1",
  sessionId: "s-1", locationId: "loc-1", soldAt: "2026-09-16T08:00:00.000Z",
  syncState: "synced", idempotencyKey: "idem-1", paymentState: "paid",
};

describe("manual WhatsApp receipt sharing", () => {
  it("builds a click-to-chat link with the receipt text", () => {
    const url = buildWhatsAppReceiptUrl(sale, { storeName: "Komola Farm" });
    expect(url).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    const message = decodeURIComponent(url!.split("?text=")[1]);
    expect(message).toContain("Receipt from Komola Farm");
    expect(message).toContain("POS-2026-000001");
    expect(message).toContain("Tomatoes");
    expect(message).toContain("₹120.00");
  });

  it("rejects a missing or invalid Indian mobile number", () => {
    expect(buildWhatsAppReceiptUrl({ ...sale, customerPhone: undefined })).toBeNull();
    expect(buildWhatsAppReceiptUrl(sale, { phone: "123" })).toBeNull();
  });
});
