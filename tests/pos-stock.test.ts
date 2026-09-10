import { describe, expect, it } from "vitest";
import { clampQuantityToStock, remainingStockBase } from "@/shared/lib/pos-stock";

describe("POS stock display", () => {
  it("reduces displayed stock as cart quantity increases", () => {
    expect(remainingStockBase(5000, 2, "kg")).toBe(3000);
  });

  it("caps cart quantity at available inventory", () => {
    expect(clampQuantityToStock(6, "kg", 5000)).toBe(5);
    expect(clampQuantityToStock(750, "g", 500)).toBe(500);
  });
});
