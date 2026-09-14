import { afterEach, describe, expect, it, vi } from "vitest";
import { salesApi } from "@/shared/lib/api";

describe("WhatsApp receipt API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the protected POS WhatsApp receipt route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "ok", data: { messageId: "msg-1", status: "submitted", phone: "+919876543210" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await salesApi.sendWhatsAppReceipt("sale-id");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/pos/sales/sale-id/whatsapp-receipt");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("gets WhatsApp message statuses for a sale", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "ok", data: { items: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await salesApi.whatsappMessages("sale-id");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/pos/sales/sale-id/whatsapp-messages");
  });
});
