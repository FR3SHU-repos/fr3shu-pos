import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  listPending: vi.fn(),
  mark: vi.fn(),
  increment: vi.fn(),
  toOperation: vi.fn((sale: { operationId: string }) => ({ operationId: sale.operationId })),
}));

vi.mock("@/shared/lib/api/client", () => ({ goRequest: mocks.request }));
vi.mock("@/shared/lib/offline/sales", () => ({
  listPendingOfflineSales: mocks.listPending,
  markOfflineSaleSyncState: mocks.mark,
  incrementOfflineSaleAttempt: mocks.increment,
  offlineSaleToSyncOperation: mocks.toOperation,
}));

import { syncPendingOfflineSales } from "@/shared/lib/api/sales";

const scope = { userId: "user-1", orgId: "org-1", locationId: "loc-1" };

describe("offline sale sync API", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.listPending.mockReset();
    mocks.mark.mockReset();
    mocks.increment.mockReset();
    mocks.toOperation.mockClear();
  });

  it("marks accepted offline sales as synced", async () => {
    mocks.listPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "accepted" }] },
    });
    mocks.mark.mockResolvedValue(true);

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.request).toHaveBeenCalledWith("sync/sales", expect.objectContaining({
      method: "POST",
      body: { operations: [{ operationId: "op-1" }] },
    }));
    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "synced");
    expect(result).toEqual({ attempted: 1, synced: 1, review: 0, authRequired: false });
  });

  it("pauses local outbox entries when authentication fails", async () => {
    mocks.listPending.mockResolvedValue([{ operationId: "op-1" }, { operationId: "op-2" }]);
    mocks.request.mockResolvedValue({ success: false, status: 403, data: null });
    mocks.mark.mockResolvedValue(true);

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "auth_required");
    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-2", "auth_required");
    expect(result.authRequired).toBe(true);
  });

  it("schedules a retry when the sync request fails transiently", async () => {
    mocks.listPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({ success: false, status: 503, data: null });

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.increment).toHaveBeenCalledWith(scope, "op-1", 60_000);
    expect(result).toEqual({ attempted: 1, synced: 0, review: 0, authRequired: false });
  });
});
