/**
 * Unit handling. Inventory is stored as an integer BASE quantity:
 *   - weight  -> grams
 *   - volume  -> millilitres
 *   - count   -> pieces
 * The seller-facing sale/display unit is stored separately on the product.
 */

export type BaseUnit = "g" | "ml" | "count";
export type SaleUnit = "kg" | "g" | "l" | "ml" | "piece" | "bunch" | "pack";
export type MeasurementUnit = "kg" | "g" | "l" | "ml" | "count" | "piece" | "each" | "bunch" | "bundle" | "pack" | "packet" | "dozen" | "box";

export const MEASUREMENT_UNITS: readonly MeasurementUnit[] = [
  "kg", "g", "l", "ml", "count", "piece", "each", "bunch", "bundle", "pack", "packet", "dozen", "box",
];

export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnit, string> = {
  kg: "kilograms (kg)",
  g: "grams (g)",
  l: "litres (l)",
  ml: "millilitres (ml)",
  count: "count",
  piece: "pieces",
  each: "each",
  bunch: "bunches",
  bundle: "bundles",
  pack: "packs",
  packet: "packets",
  dozen: "dozens",
  box: "boxes",
};

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

const MEASUREMENT_UNIT_METADATA: Record<MeasurementUnit, { baseUnit: BaseUnit; factor: number }> = {
  kg: { baseUnit: "g", factor: 1000 },
  g: { baseUnit: "g", factor: 1 },
  l: { baseUnit: "ml", factor: 1000 },
  ml: { baseUnit: "ml", factor: 1 },
  count: { baseUnit: "count", factor: 1 },
  piece: { baseUnit: "count", factor: 1 },
  each: { baseUnit: "count", factor: 1 },
  bunch: { baseUnit: "count", factor: 1 },
  bundle: { baseUnit: "count", factor: 1 },
  pack: { baseUnit: "count", factor: 1 },
  packet: { baseUnit: "count", factor: 1 },
  dozen: { baseUnit: "count", factor: 1 },
  box: { baseUnit: "count", factor: 1 },
};

export function measurementMetadata(unit: MeasurementUnit): { baseUnit: BaseUnit; factor: number } {
  return MEASUREMENT_UNIT_METADATA[unit];
}

export function preferredMeasurementUnit(baseUnit: BaseUnit, basePerSaleUnit: number, saleUnit?: string): MeasurementUnit {
  if (baseUnit === "g" && basePerSaleUnit >= 1000 && basePerSaleUnit % 1000 === 0) return "kg";
  if (baseUnit === "ml" && basePerSaleUnit >= 1000 && basePerSaleUnit % 1000 === 0) return "l";
  if (baseUnit === "count" && saleUnit && saleUnit in MEASUREMENT_UNIT_METADATA) return saleUnit as MeasurementUnit;
  return baseUnit;
}

export function measurementValue(basePerSaleUnit: number, unit: MeasurementUnit): number {
  return basePerSaleUnit / measurementMetadata(unit).factor;
}

export function formatMeasurementValue(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function defaultBaseMetadata(unit: SaleUnit): { baseUnit: BaseUnit; basePerSaleUnit: number } {
  return { baseUnit: SALE_UNIT_BASE[unit], basePerSaleUnit: BASE_PER_SALE_UNIT[unit] };
}

/** Convert a quantity expressed in a sale unit into integer base units. */
export function toBaseQuantity(qty: number, unit: SaleUnit, basePerSaleUnit = BASE_PER_SALE_UNIT[unit]): number {
  return Math.round(qty * basePerSaleUnit);
}

/** Convert an integer base quantity back into a (possibly fractional) sale-unit quantity. */
export function fromBaseQuantity(qtyBase: number, unit: SaleUnit, basePerSaleUnit = BASE_PER_SALE_UNIT[unit]): number {
  return qtyBase / basePerSaleUnit;
}

/** Human label for a base quantity in a given sale unit, e.g. 1500 g as "kg" -> "1.5 kg". */
export function formatBaseQuantity(qtyBase: number, unit: SaleUnit, basePerSaleUnit = BASE_PER_SALE_UNIT[unit]): string {
  const v = fromBaseQuantity(qtyBase, unit, basePerSaleUnit);
  const rounded = Number.isInteger(v) ? v.toString() : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${rounded} ${unit}`;
}

/** Human label for a configurable pack, e.g. "2 units × 250 g". */
export function formatPackQuantity(qtyBase: number, baseUnit: BaseUnit, basePerSaleUnit: number): string {
  if (basePerSaleUnit <= 0) return "0 units";
  const units = fromBaseQuantity(qtyBase, "pack", basePerSaleUnit);
  const roundedUnits = Number.isInteger(units) ? units.toString() : units.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${roundedUnits} units × ${basePerSaleUnit} ${baseUnit}`;
}

/** Formats inventory as the number of seller-facing product units only. */
export function formatProductUnitCount(qtyBase: number, basePerSaleUnit = 1): string {
  if (basePerSaleUnit <= 0) return "0 units";
  const units = qtyBase / basePerSaleUnit;
  const rounded = Number.isInteger(units) ? units.toString() : units.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${rounded} units`;
}

/** Explains the configured size of one seller-facing product unit. */
export function formatProductUnitEquivalence(baseUnit: BaseUnit, basePerSaleUnit = 1): string {
  if (basePerSaleUnit <= 0) return "1 unit";
  if (baseUnit === "g" && basePerSaleUnit >= 1000 && basePerSaleUnit % 1000 === 0) {
    return `1 unit = ${basePerSaleUnit / 1000} kg`;
  }
  if (baseUnit === "ml" && basePerSaleUnit >= 1000 && basePerSaleUnit % 1000 === 0) {
    return `1 unit = ${basePerSaleUnit / 1000} l`;
  }
  return `1 unit = ${basePerSaleUnit} ${baseUnit}`;
}

/** Formats a stock quantity without hiding a custom weight per product unit. */
export function formatProductQuantity(
  qtyBase: number,
  saleUnit: SaleUnit,
  baseUnit: BaseUnit = SALE_UNIT_BASE[saleUnit],
  basePerSaleUnit = BASE_PER_SALE_UNIT[saleUnit],
): string {
  if (saleUnit === "pack" || basePerSaleUnit !== BASE_PER_SALE_UNIT[saleUnit]) {
    return formatPackQuantity(qtyBase, baseUnit, basePerSaleUnit);
  }
  return formatBaseQuantity(qtyBase, saleUnit, basePerSaleUnit);
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
