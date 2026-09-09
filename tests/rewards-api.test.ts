import { afterEach, describe, expect, it, vi } from "vitest";
import { rewardsApi } from "@/shared/lib/api";

describe("buyer rewards API routes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not add the seller POS prefix", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "ok", data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await rewardsApi.summary();
    await rewardsApi.ledger(undefined, 8);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/buyer/rewards/summary");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/buyer/rewards/ledger?limit=8");
  });
});
