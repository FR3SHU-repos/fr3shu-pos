import { describe, expect, it } from "vitest";
import {
  addProductToLines,
  lineUnitPricePaise,
  removeLine,
  setLinePrice,
  setLineQty,
} from "@/shared/lib/pos/cart-lines";
import type { ProductDTO } from "@/shared/lib/api/products";

function product(overrides: Partial<ProductDTO> = {}): ProductDTO {
  return {
    _id: "p1",
    name: "Rice",
    saleUnit: "kg",
    baseUnit: "g",
    basePerSaleUnit: 1000,
    basePricePaise: 6000,
    availableBase: 5000,
    ...overrides,
  } as ProductDTO;
}

describe("addProductToLines", () => {
  it("adds a new line with the product's price and unit", () => {
    const r = addProductToLines([], product(), false);
    expect(r.error).toBeUndefined();
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({
      qty: 1,
      saleUnit: "kg",
      unitPricePaise: 6000,
      discountPaise: 0,
    });
  });

  it("bumps the quantity of an existing line", () => {
    const first = addProductToLines([], product(), false).lines;
    const r = addProductToLines(first, product(), false);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(2);
  });

  it("refuses out-of-stock products online but allows them offline", () => {
    const oos = product({ availableBase: 0 });
    expect(addProductToLines([], oos, false)).toMatchObject({
      lines: [],
      error: "This product is out of stock",
    });
    expect(addProductToLines([], oos, true).lines).toHaveLength(1);
  });

  it("stops at available stock online", () => {
    const p = product({ availableBase: 1000 });
    const one = addProductToLines([], p, false).lines;
    const r = addProductToLines(one, p, false);
    expect(r.error).toBe("No more stock is available for this product");
    expect(r.lines).toBe(one);
  });
});

describe("line mutators", () => {
  const lines = addProductToLines([], product(), false).lines;
  const key = lines[0].key;

  it("clamps quantity to stock online and floors at zero offline", () => {
    expect(setLineQty(lines, key, 99, false)[0].qty).toBe(5);
    expect(setLineQty(lines, key, 99, true)[0].qty).toBe(99);
    expect(setLineQty(lines, key, -3, true)[0].qty).toBe(0);
  });

  it("marks a price override and ignores invalid prices", () => {
    const changed = setLinePrice(lines, key, 12.5);
    expect(changed[0]).toMatchObject({ unitPricePaise: 1250, priceOverridden: true });
    expect(lineUnitPricePaise(changed[0])).toBe(1250);
    expect(setLinePrice(lines, key, -1)).toBe(lines);
    expect(setLinePrice(lines, key, NaN)).toBe(lines);
  });

  it("removes a line by key", () => {
    expect(removeLine(lines, key)).toEqual([]);
  });
});
