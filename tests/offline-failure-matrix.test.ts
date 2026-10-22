import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assessOfflineStorage,
  buildOfflineSaleRecord,
  offlineSaleToSyncOperation,
  rewriteOfflineSaleReferences,
  type OfflineScope,
} from "@/shared/lib/offline/sales";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { SessionDTO } from "@/shared/lib/api/registers";

const scope: OfflineScope = { userId: "user-1", orgId: "org-1", locationId: "loc-1" };
const session: SessionDTO = {
  _id: "shift-1", registerId: "register-1", status: "open", openedAt: "2026-10-20T09:00:00Z", closedAt: null,
  openingCashPaise: 0, expectedCashPaise: 0, countedCashPaise: 0, cashVariancePaise: 0,
  totals: { cashSalesPaise: 0, upiSalesPaise: 0, cardSalesPaise: 0, refundsPaise: 0, cashInPaise: 0, cashOutPaise: 0, saleCount: 0 },
};
const product: ProductDTO = {
  _id: "sku-1", id: "sku-1", productId: "product-1", slug: "rice", locationId: "loc-1", name: "Rice", sku: "RICE-1",
  saleUnit: "kg", baseUnit: "g", basePerSaleUnit: 1000, basePricePaise: 10000, taxRateBps: 0,
  organicStatus: "NotOrganic", status: "active", isPinned: false, availableBase: 5000,
  lots: [{ lotId: "lot-1", lotCode: "LOT-1", qty: 5000 }],
};

afterEach(() => vi.unstubAllGlobals());

describe("offline failure matrix evidence", () => {
  it("carries lot evidence and the inventory cursor into the sync payload", () => {
    const sale = buildOfflineSaleRecord({
      scope, session, cashierId: "cashier-1", lines: [{ key: "line-1", product, qty: 1, saleUnit: "kg", discountPaise: 0 }],
      cashReceivedPaise: 10000, customerName: "Asha", customerPhone: "9999999999", inventoryCursor: "42",
    }, 1);
    const operation = offlineSaleToSyncOperation(sale);
    expect(operation.inventoryCursor).toBe("42");
    expect(operation.lines[0].lotEvidence).toEqual([{ lotId: "lot-1", lotCode: "LOT-1", quantity: "5000" }]);
  });

  it("rewrites local product and lot references after their mutations sync", () => {
    const sale = buildOfflineSaleRecord({
      scope,
      session,
      cashierId: "cashier-1",
      lines: [{
        key: "line-1",
        product: { ...product, _id: "offline-product-local", id: "offline-product-local", lots: [{ lotId: "offline-lot-local", lotCode: "LOCAL-LOT", qty: 5000 }] },
        qty: 1,
        saleUnit: "kg",
        discountPaise: 0,
      }],
      cashReceivedPaise: 10000,
      customerName: "Asha",
      customerPhone: "9999999999",
      inventoryCursor: "42",
    }, 1);

    const rewritten = rewriteOfflineSaleReferences(sale, {
      productIds: { "offline-product-local": "server-sku-1" },
      lotIds: { "offline-lot-local": "server-lot-1" },
    });

    expect(rewritten.changed).toBe(true);
    expect(rewritten.sale.lines[0].productId).toBe("server-sku-1");
    expect(rewritten.sale.lines[0].lotEvidence[0].lotId).toBe("server-lot-1");
    expect(sale.lines[0].productId).toBe("offline-product-local");
  });

  it("blocks local preparation when the browser reports insufficient headroom", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockResolvedValue(false),
        estimate: vi.fn().mockResolvedValue({ quota: 20 * 1024 * 1024, usage: 12 * 1024 * 1024 }),
      },
    });
    await expect(assessOfflineStorage()).resolves.toMatchObject({ status: "unsafe", persisted: false });
  });
});
