import { afterEach, describe, expect, it, vi } from "vitest";
import { receiptsApi } from "@/shared/lib/api";

describe("buyer receipt API routes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses buyer-scoped list and detail routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "ok", data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await receiptsApi.list(10, 2);
    await receiptsApi.get("sale-id");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/buyer/receipts?page=2&limit=10");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/buyer/receipts/sale-id");
  });
});
