import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  refreshProducts: vi.fn(),
  listSales: vi.fn(),
  requeueBlockedWithStock: vi.fn(),
  claimPending: vi.fn(),
  mark: vi.fn(),
  increment: vi.fn(),
  toOperation: vi.fn((sale: { operationId: string }) => ({ operationId: sale.operationId })),
}));

vi.mock("@/shared/lib/api/client", () => ({ goRequest: mocks.request }));
vi.mock("@/shared/lib/api/products", () => ({ refreshOfflineProducts: mocks.refreshProducts }));
vi.mock("@/shared/lib/offline/sales", () => ({
  claimPendingOfflineSales: mocks.claimPending,
  listOfflineSales: mocks.listSales,
  requeueBlockedOfflineSalesWithAvailableStock: mocks.requeueBlockedWithStock,
  markOfflineSaleSyncState: mocks.mark,
  incrementOfflineSaleAttempt: mocks.increment,
  offlineSaleToSyncOperation: mocks.toOperation,
}));

import { syncPendingOfflineSales } from "@/shared/lib/api/sales";

const scope = { userId: "user-1", orgId: "org-1", locationId: "loc-1" };

describe("offline sale sync API", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.refreshProducts.mockReset();
    mocks.refreshProducts.mockResolvedValue(null);
    mocks.listSales.mockReset();
    mocks.listSales.mockResolvedValue([{ syncState: "pending" }]);
    mocks.requeueBlockedWithStock.mockReset();
    mocks.requeueBlockedWithStock.mockResolvedValue(0);
    mocks.claimPending.mockReset();
    mocks.mark.mockReset();
    mocks.increment.mockReset();
    mocks.toOperation.mockClear();
  });

  it("marks accepted offline sales as synced", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "accepted", sale: { id: "sale-1", receiptNo: "POS-2026-000009" } }] },
    });
    mocks.mark.mockResolvedValue(true);

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.request).toHaveBeenCalledWith("sync/sales", expect.objectContaining({
      method: "POST",
      body: { operations: [{ operationId: "op-1" }] },
    }));
    expect(mocks.refreshProducts).toHaveBeenCalledTimes(2);
    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "synced", expect.objectContaining({
      message: "Synced to the server as POS-2026-000009.",
      serverSaleId: "sale-1",
      serverReceiptNo: "POS-2026-000009",
    }));
    expect(result).toEqual({ attempted: 1, synced: 1, blocked: 0, authRequired: false, blockedMessages: [] });
  });

  it("does not download the catalogue when there is no local sync work", async () => {
    mocks.listSales.mockResolvedValue([]);

    const result = await syncPendingOfflineSales(scope);

    expect(result).toEqual({ attempted: 0, synced: 0, blocked: 0, authRequired: false, blockedMessages: [] });
    expect(mocks.refreshProducts).not.toHaveBeenCalled();
    expect(mocks.claimPending).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("pauses local outbox entries when authentication fails", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }, { operationId: "op-2" }]);
    mocks.request.mockResolvedValue({ success: false, status: 403, data: null });
    mocks.mark.mockResolvedValue(true);

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "auth_required", expect.objectContaining({ message: "Sign in again before syncing this sale." }));
    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-2", "auth_required", expect.objectContaining({ message: "Sign in again before syncing this sale." }));
    expect(result.authRequired).toBe(true);
  });

  it("schedules a retry when the sync request fails transiently", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({ success: false, status: 503, data: null });

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.increment).toHaveBeenCalledWith(scope, "op-1", expect.any(Number), "Offline sale sync did not complete. The sale will retry automatically.");
    expect(result).toEqual({ attempted: 1, synced: 0, blocked: 0, authRequired: false, message: "Offline sale sync did not complete.", blockedMessages: [] });
  });

  it("sends unresolved local references to the server for durable review", async () => {
    mocks.claimPending.mockResolvedValue([{
      operationId: "op-1",
      lines: [{ productId: "offline-product-local", lotEvidence: [] }],
    }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "needs_review", reason: "offline_manual_review", reviewId: "review-1" }] },
    });

    await syncPendingOfflineSales(scope);

    expect(mocks.request).toHaveBeenCalledWith("sync/sales", expect.objectContaining({
      body: { operations: [{ operationId: "op-1" }] },
    }));
    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "needs_review", expect.objectContaining({
      reviewId: "review-1",
      message: expect.stringContaining("preserved for manual review"),
    }));
  });

  it("reports clearly when the backend route is not loaded", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({ success: false, status: 404, data: null });

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.increment).toHaveBeenCalledWith(scope, "op-1", expect.any(Number), "The backend sync endpoint is unavailable. The sale will retry automatically.");
    expect(result.unavailable).toBe(true);
    expect(result.message).toContain("backend sync endpoint");
  });

  it("blocks rejected sales with an automatic check reason", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "rejected", reason: "invalid_cash" }] },
    });

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "blocked", expect.objectContaining({ message: expect.stringContaining("cash") }));
    expect(result).toEqual({ attempted: 1, synced: 0, blocked: 1, authRequired: false, blockedMessages: [expect.stringContaining("cash")] });
  });

  it("keeps stale catalogue sales in needs-review state", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "needs_review", reason: "stale_price" }] },
    });

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.mark).toHaveBeenCalledWith(scope, "op-1", "needs_review", expect.objectContaining({
      message: "Review required: one product's price changed after this sale was recorded.",
    }));
    expect(result).toEqual({
      attempted: 1,
      synced: 0,
      blocked: 1,
      authRequired: false,
      blockedMessages: ["Review required: one product's price changed after this sale was recorded."],
    });
  });

  it("keeps retrying server-side sync failures automatically", async () => {
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "retry", reason: "server_error" }] },
    });

    const result = await syncPendingOfflineSales(scope);

    expect(mocks.increment).toHaveBeenCalledWith(scope, "op-1", expect.any(Number), expect.stringContaining("retry automatically"));
    expect(result).toEqual({ attempted: 1, synced: 0, blocked: 0, authRequired: false, blockedMessages: [] });
  });

  it("refreshes products and requeues blocked stock sales before reading pending sales", async () => {
    const refreshed = { items: [{ _id: "sku-1", availableBase: 5000 }], savedAt: 1234 };
    mocks.refreshProducts.mockResolvedValueOnce(refreshed).mockResolvedValueOnce(null);
    mocks.requeueBlockedWithStock.mockResolvedValue(1);
    mocks.claimPending.mockResolvedValue([{ operationId: "op-1" }]);
    mocks.request.mockResolvedValue({
      success: true,
      status: 200,
      data: { results: [{ operationId: "op-1", outcome: "accepted" }] },
    });
    mocks.mark.mockResolvedValue(true);

    await syncPendingOfflineSales(scope);

    expect(mocks.requeueBlockedWithStock).toHaveBeenCalledWith(scope, refreshed.items, refreshed.savedAt);
    expect(mocks.requeueBlockedWithStock.mock.invocationCallOrder[0]).toBeLessThan(mocks.claimPending.mock.invocationCallOrder[0]);
  });

});
