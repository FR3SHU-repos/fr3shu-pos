import { describe, expect, it } from "vitest";
import type { SaleDTO } from "@/shared/lib/api/sales";
import { buildOfflineSaleRecord, exportOfflineSales, cleanupOfflineSales, type OfflineSaleRecord, type OfflineScope } from "@/shared/lib/offline/sales";
import { expectedCashWithOffline, mergeSalesWithOffline, pendingOfflineCashTotal, visibleOfflineSales } from "@/shared/lib/offline/session-summary";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { SessionDTO } from "@/shared/lib/api/registers";
import type { CartLine } from "@/shared/components/pos/types";

const scope: OfflineScope = { userId: "user-1", orgId: "org-1", locationId: "loc-1" };
const session: SessionDTO = {
  _id: "shift-1",
  registerId: "register-1",
  status: "open",
  openedAt: "2026-09-13T05:00:00.000Z",
  closedAt: null,
  openingCashPaise: 10000,
  expectedCashPaise: 10000,
  countedCashPaise: 0,
  cashVariancePaise: 0,
  totals: { cashSalesPaise: 0, upiSalesPaise: 0, cardSalesPaise: 0, refundsPaise: 0, cashInPaise: 0, cashOutPaise: 0, saleCount: 0 },
};

function product(overrides: Partial<ProductDTO> = {}): ProductDTO {
  return {
    _id: "sku-1",
    id: "sku-1",
    productId: "product-1",
    slug: "tomato",
    locationId: "loc-1",
    name: "Tomato",
    sku: "TOM-1",
    saleUnit: "kg",
    baseUnit: "g",
    basePerSaleUnit: 1000,
    basePricePaise: 6000,
    taxRateBps: 0,
    organicStatus: "Verified",
    status: "active",
    isPinned: false,
    availableBase: 5000,
    ...overrides,
  };
}

function line(overrides: Partial<CartLine> = {}): CartLine {
  return { key: "line-1", product: product(), qty: 1, saleUnit: "kg", discountPaise: 0, ...overrides };
}

function offlineSale(operationId: string, soldAt: string, overrides: Partial<OfflineSaleRecord> = {}) {
  return {
    ...buildOfflineSaleRecord({ scope, session, cashierId: "cashier-1", lines: [line()], cashReceivedPaise: 10000, customerName: "Asha", operationId }, 1, new Date(soldAt)),
    ...overrides,
  };
}

function serverSale(id: string, soldAt: string): SaleDTO {
  return {
    _id: id,
    receiptNo: `POS-${id}`,
    status: "completed",
    items: [],
    grossPaise: 6000,
    discountPaise: 0,
    taxPaise: 0,
    totalPaise: 6000,
    cashierId: "cashier-1",
    registerId: "register-1",
    sessionId: "shift-1",
    locationId: "loc-1",
    soldAt,
    syncState: "synced",
    idempotencyKey: "",
    paymentState: "paid",
  };
}

describe("offline session summaries", () => {
  it("adds pending offline cash to drawer expectations", () => {
    const pending = offlineSale("op-pending", "2026-09-14T08:00:00.000Z");
    const synced = offlineSale("op-synced", "2026-09-14T08:05:00.000Z", { syncState: "synced" });

    expect(pendingOfflineCashTotal([pending, synced])).toEqual({ amountPaise: 6000, count: 1 });
    expect(expectedCashWithOffline({ openingCashPaise: 10000, serverCashSalesPaise: 4000, refundsPaise: 1000, pendingOfflineCashPaise: 6000 })).toEqual({
      serverExpectedPaise: 13000,
      combinedExpectedPaise: 19000,
    });
  });

  it("merges active local sales with completed server sales", () => {
    const syncedLocal = offlineSale("op-synced", "2026-09-14T08:10:00.000Z", {
      syncState: "synced",
      serverSaleId: "server-1",
      serverReceiptNo: "POS-server-1",
      lastSyncAttemptAt: "2026-09-14T08:11:00.000Z",
    });
    const pending = offlineSale("op-pending", "2026-09-14T08:20:00.000Z");

    const rows = mergeSalesWithOffline([serverSale("server-1", "2026-09-14T08:10:00.000Z"), serverSale("server-2", "2026-09-14T08:00:00.000Z")], [syncedLocal, pending], "2026-09-14");

    expect(rows.map((row) => `${row.local ? "local" : "server"}:${row.serverSaleId ?? row.sale._id}`)).toEqual([
      `local:${pending.id}`,
      "server:server-1",
      "server:server-2",
    ]);
  });

  it("hides synced local receipts from active offline views", () => {
    const today = offlineSale("op-today", "2026-09-14T08:00:00.000Z", { syncState: "synced", lastSyncAttemptAt: "2026-09-14T08:30:00.000Z" });
    const pending = offlineSale("op-pending", "2026-09-14T08:10:00.000Z");

    expect(visibleOfflineSales([today, pending], "2026-09-14").map((sale) => sale.operationId)).toEqual(["op-pending"]);
  });

  it("is safe without IndexedDB for export and cleanup helpers", async () => {
    await expect(exportOfflineSales(scope)).resolves.toMatchObject({ scope, sales: [] });
    await expect(cleanupOfflineSales(scope, 0)).resolves.toBe(0);
  });
});
