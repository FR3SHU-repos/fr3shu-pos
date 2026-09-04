/**
 * Money helpers. Monetary values are ALWAYS integer paise in storage and transport.
 * Rupees only appear at the UI edge.
 */

/** Round to the nearest whole paise. Guards against float drift from tax/discount math. */
export const toPaise = (value: number): number => Math.round(value);

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const paiseToRupees = (paise: number): number => paise / 100;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer paise as an Indian-locale currency string, e.g. 123456 -> "₹1,234.56". */
export const formatPaise = (paise: number): string => inr.format(paise / 100);

const inrNumber = new Intl.NumberFormat("en-IN");
export const formatIndianNumber = (n: number): string => inrNumber.format(n);

/**
 * Line total for a POS item, all in paise.
 * qtyBase is an integer base quantity (grams / millilitres / count).
 * unitPricePaise is the price for ONE sale unit (kg / litre / piece / ...).
 * basePerSaleUnit converts the two (e.g. 1000 for kg->g, 1 for piece->count).
 * taxRateBps is tax in basis points (e.g. 500 = 5%). Tax is computed on the
 * post-discount amount.
 */
export interface LineTotals {
  grossPaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxPaise: number;
  netPaise: number;
}

export function computeLineTotals(args: {
  qtyBase: number;
  unitPricePaise: number;
  basePerSaleUnit: number;
  taxRateBps: number;
  discountPaise?: number;
}): LineTotals {
  const { qtyBase, unitPricePaise, basePerSaleUnit, taxRateBps } = args;
  if (basePerSaleUnit <= 0) throw new Error("basePerSaleUnit must be > 0");
  const grossPaise = toPaise((qtyBase * unitPricePaise) / basePerSaleUnit);
  const discountPaise = Math.min(Math.max(args.discountPaise ?? 0, 0), grossPaise);
  const taxablePaise = grossPaise - discountPaise;
  const taxPaise = toPaise((taxablePaise * taxRateBps) / 10000);
  const netPaise = taxablePaise + taxPaise;
  return { grossPaise, discountPaise, taxablePaise, taxPaise, netPaise };
}

export interface CartTotals {
  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
  netPaise: number;
}

export function sumCartTotals(lines: LineTotals[], cartDiscountPaise = 0): CartTotals {
  const gross = lines.reduce((s, l) => s + l.grossPaise, 0);
  const lineDiscount = lines.reduce((s, l) => s + l.discountPaise, 0);
  const tax = lines.reduce((s, l) => s + l.taxPaise, 0);
  const netBeforeCartDiscount = lines.reduce((s, l) => s + l.netPaise, 0);
  const clampedCartDiscount = Math.min(Math.max(cartDiscountPaise, 0), netBeforeCartDiscount);
  return {
    grossPaise: gross,
    discountPaise: lineDiscount + clampedCartDiscount,
    taxPaise: tax,
    netPaise: netBeforeCartDiscount - clampedCartDiscount,
  };
}
