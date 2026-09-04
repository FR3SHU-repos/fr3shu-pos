import { describe, it, expect } from "vitest";
import {
  EMPTY_TOTALS,
  expectedCashPaise,
  computeClose,
  tenderDeltaFromPayments,
} from "@/shared/services/registers";

describe("register day-close math", () => {
  it("expected cash = opening + cash sales - refunds + cash in - cash out", () => {
    const totals = {
      ...EMPTY_TOTALS,
      cashSalesPaise: 45000,
      refundsPaise: 5000,
      cashInPaise: 2000,
      cashOutPaise: 1000,
    };
    expect(expectedCashPaise(200000, totals)).toBe(200000 + 45000 - 5000 + 2000 - 1000);
  });

  it("flags a note requirement only above the threshold", () => {
    const base = {
      openingCashPaise: 100000,
      totals: { ...EMPTY_TOTALS, cashSalesPaise: 50000 },
      varianceNoteThresholdPaise: 20000,
    };
    const ok = computeClose({ ...base, countedCashPaise: 155000 });
    expect(ok.cashVariancePaise).toBe(5000);
    expect(ok.noteRequired).toBe(false);

    const big = computeClose({ ...base, countedCashPaise: 125000 });
    expect(big.cashVariancePaise).toBe(-25000);
    expect(big.noteRequired).toBe(true);
  });

  it("splits tender by method", () => {
    const d = tenderDeltaFromPayments([
      { method: "cash", amountPaise: 3000 },
      { method: "upi", amountPaise: 7000 },
      { method: "cash", amountPaise: 1000 },
    ]);
    expect(d).toEqual({ cashSalesPaise: 4000, upiSalesPaise: 7000, cardSalesPaise: 0 });
  });
});
