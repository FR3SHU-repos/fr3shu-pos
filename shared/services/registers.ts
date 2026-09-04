import type { PosSessionTotals } from "@/shared/interfaces/mongodb/pos/posSession";

export const EMPTY_TOTALS: PosSessionTotals = {
  cashSalesPaise: 0,
  upiSalesPaise: 0,
  cardSalesPaise: 0,
  refundsPaise: 0,
  cashInPaise: 0,
  cashOutPaise: 0,
  saleCount: 0,
};

/**
 * Expected cash in the drawer at close:
 *   opening + cash sales - cash refunds + cash in - cash out
 */
export function expectedCashPaise(openingCashPaise: number, totals: PosSessionTotals): number {
  return (
    openingCashPaise +
    totals.cashSalesPaise -
    totals.refundsPaise +
    totals.cashInPaise -
    totals.cashOutPaise
  );
}

export interface CloseComputation {
  expectedCashPaise: number;
  cashVariancePaise: number;
  /** true when |variance| exceeds the threshold and a note is required. */
  noteRequired: boolean;
}

export function computeClose(args: {
  openingCashPaise: number;
  totals: PosSessionTotals;
  countedCashPaise: number;
  varianceNoteThresholdPaise: number;
}): CloseComputation {
  const expected = expectedCashPaise(args.openingCashPaise, args.totals);
  const variance = args.countedCashPaise - expected;
  return {
    expectedCashPaise: expected,
    cashVariancePaise: variance,
    noteRequired: Math.abs(variance) > args.varianceNoteThresholdPaise,
  };
}

/** How a completed sale's tender contributes to session running totals. */
export function tenderDeltaFromPayments(
  payments: { method: "cash" | "upi" | "card"; amountPaise: number }[],
): Pick<PosSessionTotals, "cashSalesPaise" | "upiSalesPaise" | "cardSalesPaise"> {
  const out = { cashSalesPaise: 0, upiSalesPaise: 0, cardSalesPaise: 0 };
  for (const p of payments) {
    if (p.method === "cash") out.cashSalesPaise += p.amountPaise;
    else if (p.method === "upi") out.upiSalesPaise += p.amountPaise;
    else out.cardSalesPaise += p.amountPaise;
  }
  return out;
}
