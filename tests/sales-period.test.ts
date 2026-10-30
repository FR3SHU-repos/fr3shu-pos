import { describe, expect, it } from "vitest";
import {
  combineSummary,
  inBounds,
  normalizePhoneSearch,
  periodBounds,
  PERIODS,
} from "@/shared/lib/pos/sales-period";

// Wednesday 15 Oct 2025, 15:30 local time.
const NOW = new Date(2025, 9, 15, 15, 30, 0);
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m, d, h, min).toISOString();

describe("periodBounds", () => {
  it("covers local midnight to the next local midnight for today", () => {
    expect(periodBounds("today", NOW)).toEqual({
      from: local(2025, 9, 15),
      to: local(2025, 9, 16),
    });
  });

  it("covers the previous local day for yesterday", () => {
    expect(periodBounds("yesterday", NOW)).toEqual({
      from: local(2025, 9, 14),
      to: local(2025, 9, 15),
    });
  });

  it("covers today and the six days before for the 7-day chip", () => {
    expect(periodBounds("week", NOW)).toEqual({ from: local(2025, 9, 9), to: local(2025, 9, 16) });
  });

  it("is unbounded for All", () => {
    expect(periodBounds("all", NOW)).toEqual({});
  });

  it("crosses month and year boundaries", () => {
    const jan1 = new Date(2026, 0, 1, 9, 0);
    expect(periodBounds("yesterday", jan1)).toEqual({
      from: local(2025, 11, 31),
      to: local(2026, 0, 1),
    });
    expect(periodBounds("week", jan1).from).toBe(local(2025, 11, 26));
  });

  it("offers the four chips in display order", () => {
    expect(PERIODS.map((p) => p.key)).toEqual(["today", "yesterday", "week", "all"]);
  });
});

describe("inBounds", () => {
  const today = periodBounds("today", NOW);

  it("includes the start and excludes the exclusive end", () => {
    expect(inBounds(local(2025, 9, 15), today)).toBe(true);
    expect(inBounds(local(2025, 9, 15, 23, 59), today)).toBe(true);
    expect(inBounds(local(2025, 9, 16), today)).toBe(false);
    expect(inBounds(local(2025, 9, 14, 23, 59), today)).toBe(false);
  });

  it("accepts anything when unbounded", () => {
    expect(inBounds(0, {})).toBe(true);
    expect(inBounds("2020-01-01T00:00:00Z", {})).toBe(true);
  });
});

describe("normalizePhoneSearch", () => {
  it("keeps digits only", () => {
    expect(normalizePhoneSearch("98765 43210")).toBe("9876543210");
  });

  it("uses the last 10 digits when a country code is typed", () => {
    expect(normalizePhoneSearch("+91 98765 43210")).toBe("9876543210");
  });

  it("leaves partial numbers alone", () => {
    expect(normalizePhoneSearch("98x7")).toBe("987");
    expect(normalizePhoneSearch("")).toBe("");
  });
});

describe("combineSummary", () => {
  it("adds unsynced offline sales to the server total", () => {
    expect(
      combineSummary({ completedCount: 4, totalPaise: 120000 }, { count: 2, totalPaise: 30000 }),
    ).toEqual({
      completedCount: 6,
      totalPaise: 150000,
      hasData: true,
    });
  });

  it("shows offline-only totals before the server has a summary", () => {
    expect(combineSummary(null, { count: 1, totalPaise: 5000 })).toEqual({
      completedCount: 1,
      totalPaise: 5000,
      hasData: true,
    });
  });

  it("reports no data when there is neither", () => {
    expect(combineSummary(null, { count: 0, totalPaise: 0 }).hasData).toBe(false);
  });

  it("still shows a server summary with zero sales", () => {
    expect(
      combineSummary({ completedCount: 0, totalPaise: 0 }, { count: 0, totalPaise: 0 }).hasData,
    ).toBe(true);
  });
});
