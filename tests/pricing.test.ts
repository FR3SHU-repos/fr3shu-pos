import { describe, it, expect } from "vitest";
import { resolveUnitPricePaise, priceSaleLine } from "@/shared/services/pricing";
import type { IProductPrice } from "@/shared/interfaces/mongodb/catalog/productPrice";

const product = {
  _id: "p1",
  name: "Organic Tomatoes",
  basePricePaise: 5500,
  taxRateBps: 0,
  basePerSaleUnit: 1000,
};

function price(over: Partial<IProductPrice>): IProductPrice {
  return {
    orgId: "o1",
    productId: "p1",
    locationId: "l1",
    unitPricePaise: 6000,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    isActive: true,
    ...over,
  };
}

describe("resolveUnitPricePaise", () => {
  it("prefers the most recent active in-window location price", () => {
    const prices = [
      price({ unitPricePaise: 6000, effectiveFrom: new Date("2026-01-01") }),
      price({ unitPricePaise: 6500, effectiveFrom: new Date("2026-06-01") }),
    ];
    expect(resolveUnitPricePaise(product, prices, new Date("2026-07-01"))).toBe(6500);
  });

  it("ignores prices outside their window and falls back to basePricePaise", () => {
    const prices = [price({ effectiveTo: new Date("2026-02-01") })];
    expect(resolveUnitPricePaise(product, prices, new Date("2026-07-01"))).toBe(5500);
  });

  it("throws when there is no price at all", () => {
    expect(() =>
      resolveUnitPricePaise({ _id: "p1", name: "X" }, [], new Date()),
    ).toThrow(/No active price/);
  });
});

describe("priceSaleLine", () => {
  it("computes a line from the server price, not any client amount", () => {
    const res = priceSaleLine({
      product,
      locationPrices: [price({ unitPricePaise: 6000 })],
      qtyBase: 2000, // 2 kg
      at: new Date("2026-02-01"),
    });
    expect(res.unitPricePaise).toBe(6000);
    expect(res.totals.netPaise).toBe(12000);
  });
});
