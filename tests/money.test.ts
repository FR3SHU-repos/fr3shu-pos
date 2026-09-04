import { describe, it, expect } from "vitest";
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  computeLineTotals,
  sumCartTotals,
} from "@/shared/lib/money";

describe("money conversions", () => {
  it("round-trips rupees and paise as integers", () => {
    expect(rupeesToPaise(95)).toBe(9500);
    expect(rupeesToPaise(72.5)).toBe(7250);
    expect(paiseToRupees(9500)).toBe(95);
  });

  it("formats paise in Indian locale currency", () => {
    expect(formatPaise(123456)).toBe("₹1,234.56");
    expect(formatPaise(0)).toBe("₹0.00");
  });
});

describe("computeLineTotals", () => {
  it("prices a weight line with unit conversion (1.5 kg @ ₹60/kg, no tax)", () => {
    const t = computeLineTotals({
      qtyBase: 1500, // grams
      unitPricePaise: 6000, // ₹60 per kg
      basePerSaleUnit: 1000, // kg -> g
      taxRateBps: 0,
    });
    expect(t.grossPaise).toBe(9000);
    expect(t.taxPaise).toBe(0);
    expect(t.netPaise).toBe(9000);
  });

  it("applies tax on the post-discount amount", () => {
    const t = computeLineTotals({
      qtyBase: 1, // one pack
      unitPricePaise: 38000, // ₹380
      basePerSaleUnit: 1,
      taxRateBps: 500, // 5%
      discountPaise: 3000, // ₹30 off
    });
    expect(t.grossPaise).toBe(38000);
    expect(t.discountPaise).toBe(3000);
    expect(t.taxablePaise).toBe(35000);
    expect(t.taxPaise).toBe(1750);
    expect(t.netPaise).toBe(36750);
  });

  it("never lets a discount exceed the line gross", () => {
    const t = computeLineTotals({
      qtyBase: 1,
      unitPricePaise: 1000,
      basePerSaleUnit: 1,
      taxRateBps: 0,
      discountPaise: 999999,
    });
    expect(t.discountPaise).toBe(1000);
    expect(t.netPaise).toBe(0);
  });
});

describe("sumCartTotals", () => {
  it("adds line totals and clamps a cart-level discount", () => {
    const lines = [
      computeLineTotals({ qtyBase: 1000, unitPricePaise: 6000, basePerSaleUnit: 1000, taxRateBps: 0 }),
      computeLineTotals({ qtyBase: 2000, unitPricePaise: 9500, basePerSaleUnit: 1000, taxRateBps: 0 }),
    ];
    const cart = sumCartTotals(lines, 1000);
    expect(cart.grossPaise).toBe(6000 + 19000);
    expect(cart.discountPaise).toBe(1000);
    expect(cart.netPaise).toBe(25000 - 1000);
  });
});
