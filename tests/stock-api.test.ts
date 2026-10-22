import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn(), offline: false }));

vi.mock("@/shared/lib/api/client", () => ({ goRequest: mocks.request }));
vi.mock("@/shared/lib/offline/products", () => ({ isOffline: () => mocks.offline }));

import * as stock from "@/shared/lib/api/stock";

beforeEach(() => {
  mocks.offline = false;
  mocks.request.mockReset();
});

describe("offline stock API", () => {
  it("blocks stock receipts while offline", async () => {
    mocks.offline = true;
    const result = await stock.add({ skuId: "product-1", quantity: "10" });
    expect(result.success).toBe(false);
    expect(result.code).toBe("offline_unavailable");
    expect(result.message).toContain("stock changes are disabled");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("uses the server while online", async () => {
    mocks.request.mockResolvedValue({ success: true, data: { lotId: "lot-1" }, status: 201 });
    const body = { skuId: "product-1", quantity: "10" };
    await stock.add(body);
    expect(mocks.request).toHaveBeenCalledWith("inventory/receipts", { method: "POST", body });
  });
});
