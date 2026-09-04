import { describe, it, expect } from "vitest";
import {
  toBaseQuantity,
  fromBaseQuantity,
  formatBaseQuantity,
  sortLotsFefo,
} from "@/shared/lib/units";

describe("unit conversion", () => {
  it("converts sale units to integer base units", () => {
    expect(toBaseQuantity(1.5, "kg")).toBe(1500);
    expect(toBaseQuantity(0.25, "l")).toBe(250);
    expect(toBaseQuantity(3, "piece")).toBe(3);
    expect(toBaseQuantity(2, "bunch")).toBe(2);
  });

  it("round-trips base quantities", () => {
    expect(fromBaseQuantity(1500, "kg")).toBe(1.5);
    expect(formatBaseQuantity(1500, "kg")).toBe("1.5 kg");
    expect(formatBaseQuantity(3, "piece")).toBe("3 piece");
  });
});

describe("sortLotsFefo", () => {
  it("orders by earliest expiry first, then packing date, then creation", () => {
    const lots = [
      { _id: "c", expiryDate: "2026-02-01" },
      { _id: "a", expiryDate: "2026-01-01" },
      { _id: "b", expiryDate: "2026-01-15" },
      { _id: "d", expiryDate: null, packingDate: "2025-12-01" },
    ];
    expect(sortLotsFefo(lots).map((l) => l._id)).toEqual(["a", "b", "c", "d"]);
  });
});
