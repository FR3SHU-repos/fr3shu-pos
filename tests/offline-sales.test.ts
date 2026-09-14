import { describe, expect, it } from "vitest";
import {
  buildOfflineSaleRecord,
  applyLocalStockDeductions,
  localStockDeductions,
  offlineSaleToDTO,
  parseRupeesToPaise,
  validateCashPayment,
  type OfflineSaleRecord,
  type OfflineScope,
} from "@/shared/lib/offline/sales";
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
  totals: {
    cashSalesPaise: 0,
    upiSalesPaise: 0,
    cardSalesPaise: 0,
    refundsPaise: 0,
    cashInPaise: 0,
    cashOutPaise: 0,
    saleCount: 0,
  },
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
  return {
    key: "line-1",
    product: product(),
    qty: 1.5,
    saleUnit: "kg",
    discountPaise: 0,
    ...overrides,
  };
}

describe("offline cash sales", () => {
  it("parses rupee input into integer paise", () => {
    expect(parseRupeesToPaise("95")).toBe(9500);
    expect(parseRupeesToPaise("95.5")).toBe(9550);
    expect(parseRupeesToPaise("95.55")).toBe(9555);
    expect(parseRupeesToPaise("95.555")).toBeNull();
    expect(parseRupeesToPaise("-1")).toBeNull();
  });

  it("requires received cash to cover the sale total", () => {
    expect(validateCashPayment(9000, 10000)).toEqual({
      method: "cash",
      amountPaise: 9000,
      receivedPaise: 10000,
      changePaise: 1000,
    });
    expect(() => validateCashPayment(9000, 8999)).toThrow("Cash received is less than the sale total.");
  });

  it("builds an immutable pending sale and receipt DTO", () => {
    const sale = buildOfflineSaleRecord(
      {
        scope,
        session,
        cashierId: "cashier-1",
        lines: [line()],
        cashReceivedPaise: 10000,
        customerName: "Asha",
        customerPhone: "9999999999",
        operationId: "op-1",
      },
      7,
      new Date("2026-09-13T06:30:00.000Z"),
    );

    expect(sale.receiptNo).toBe("LOCAL-REGISTER-000007");
    expect(sale.totalPaise).toBe(9000);
    expect(sale.payment).toMatchObject({ receivedPaise: 10000, changePaise: 1000 });
    expect(sale.lines[0]).toMatchObject({ sku: "TOM-1", qtyBase: 1500, unitPricePaise: 6000 });

    const dto = offlineSaleToDTO(sale);
    expect(dto.syncState).toBe("pending");
    expect(dto.receiptNo).toBe(sale.receiptNo);
    expect(dto.totalPaise).toBe(9000);
  });

  it("rejects products that are not eligible for offline checkout", () => {
    expect(() =>
      buildOfflineSaleRecord(
        {
          scope,
          session,
          cashierId: "cashier-1",
          lines: [line({ product: product({ status: "inactive" }) })],
          cashReceivedPaise: 10000,
          customerName: "Asha",
        },
        1,
      ),
    ).toThrow("Tomato is not active.");

    expect(() =>
      buildOfflineSaleRecord(
        {
          scope,
          session,
          cashierId: "cashier-1",
          lines: [line({ product: product({ basePricePaise: undefined }) })],
          cashReceivedPaise: 10000,
          customerName: "Asha",
        },
        1,
      ),
    ).toThrow("Tomato has no saved price.");
  });

  it("subtracts local offline sales from cached stock", () => {
    const pending = buildOfflineSaleRecord(
      {
        scope,
        session,
        cashierId: "cashier-1",
        lines: [line()],
        cashReceivedPaise: 10000,
        customerName: "Asha",
        operationId: "op-1",
      },
      1,
      new Date("2026-09-13T06:00:00.000Z"),
    );
    const syncedBeforeSnapshot: OfflineSaleRecord = {
      ...pending,
      id: "op-2",
      operationId: "op-2",
      syncState: "synced",
      createdAt: "2026-09-13T05:00:00.000Z",
    };
    const deductions = localStockDeductions([pending, syncedBeforeSnapshot], Date.parse("2026-09-13T05:30:00.000Z"));

    expect(deductions["sku-1"]).toBe(1500);
    expect(applyLocalStockDeductions([product()], deductions)[0].availableBase).toBe(3500);
  });

  it("rejects overselling after prior local offline sales", () => {
    expect(() =>
      buildOfflineSaleRecord(
        {
          scope,
          session,
          cashierId: "cashier-1",
          lines: [line({ qty: 4 })],
          cashReceivedPaise: 24000,
          customerName: "Asha",
        },
        2,
        new Date("2026-09-13T06:30:00.000Z"),
        { "sku-1": 1500 },
      ),
    ).toThrow("Tomato does not have enough offline stock.");
  });
});
