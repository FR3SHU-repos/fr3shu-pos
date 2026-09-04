/**
 * Unit handling. Inventory is stored as an integer BASE quantity:
 *   - weight  -> grams
 *   - volume  -> millilitres
 *   - count   -> pieces
 * The seller-facing sale/display unit is stored separately on the product.
 */

export type BaseUnit = "g" | "ml" | "count";
export type SaleUnit = "kg" | "g" | "l" | "ml" | "piece" | "bunch" | "pack";

/** How many base units are in ONE of the given sale unit. */
export const BASE_PER_SALE_UNIT: Record<SaleUnit, number> = {
  kg: 1000,
  g: 1,
  l: 1000,
  ml: 1,
  piece: 1,
  bunch: 1,
  pack: 1,
};

export const SALE_UNIT_BASE: Record<SaleUnit, BaseUnit> = {
  kg: "g",
  g: "g",
  l: "ml",
  ml: "ml",
  piece: "count",
  bunch: "count",
  pack: "count",
};

/** Convert a quantity expressed in a sale unit into integer base units. */
export function toBaseQuantity(qty: number, unit: SaleUnit): number {
  return Math.round(qty * BASE_PER_SALE_UNIT[unit]);
}

/** Convert an integer base quantity back into a (possibly fractional) sale-unit quantity. */
export function fromBaseQuantity(qtyBase: number, unit: SaleUnit): number {
  return qtyBase / BASE_PER_SALE_UNIT[unit];
}

/** Human label for a base quantity in a given sale unit, e.g. 1500 g as "kg" -> "1.5 kg". */
export function formatBaseQuantity(qtyBase: number, unit: SaleUnit): string {
  const v = fromBaseQuantity(qtyBase, unit);
  const rounded = Number.isInteger(v) ? v.toString() : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${rounded} ${unit}`;
}

export interface FefoLotLike {
  _id?: string;
  expiryDate?: Date | string | null;
  packingDate?: Date | string | null;
  createdAt?: Date | string | null;
}

const time = (d?: Date | string | null): number =>
  d ? new Date(d).getTime() : Number.POSITIVE_INFINITY;

/**
 * First-Expired-First-Out ordering. Lots with the earliest expiry come first;
 * missing expiry falls back to packing date, then creation order.
 */
export function sortLotsFefo<T extends FefoLotLike>(lots: T[]): T[] {
  return [...lots].sort((a, b) => {
    const ea = time(a.expiryDate);
    const eb = time(b.expiryDate);
    if (ea !== eb) return ea - eb;
    const pa = time(a.packingDate);
    const pb = time(b.packingDate);
    if (pa !== pb) return pa - pb;
    return time(a.createdAt) - time(b.createdAt);
  });
}
