import type { ProductDTO } from "@/shared/lib/api/products";
import type { CartLine } from "@/shared/components/pos/types";
import {
  defaultBaseMetadata,
  measurementMetadata,
  measurementValue,
  preferredMeasurementUnit,
  type BaseUnit,
  type MeasurementUnit,
  type SaleUnit,
} from "@/shared/lib/units";
import { clampQuantityToStock } from "@/shared/lib/pos-stock";
import { newUuid } from "@/shared/lib/uuid";

export function lineBaseUnit(line: CartLine): BaseUnit {
  return line.baseUnit ?? line.product.baseUnit ?? defaultBaseMetadata(line.saleUnit).baseUnit;
}

export function lineBasePerSaleUnit(line: CartLine): number {
  return line.basePerSaleUnit ?? line.product.basePerSaleUnit;
}

export function lineUnitPricePaise(line: CartLine): number {
  return line.unitPricePaise ?? line.product.basePricePaise ?? 0;
}

export interface AddResult {
  lines: CartLine[];
  /** Set when the product could not be added; `lines` is then the unchanged input. */
  error?: string;
}

/** Pure: add one unit of `p`, or bump an existing line. Stock is only enforced online. */
export function addProductToLines(prev: CartLine[], p: ProductDTO, offline: boolean): AddResult {
  const idx = prev.findIndex((l) => l.product._id === p._id);
  if (idx >= 0) {
    const copy = [...prev];
    const next = offline
      ? copy[idx].qty + 1
      : clampQuantityToStock(
          copy[idx].qty + 1,
          copy[idx].saleUnit,
          p.availableBase,
          p.basePerSaleUnit,
        );
    if (!offline && next === copy[idx].qty) {
      return { lines: prev, error: "No more stock is available for this product" };
    }
    copy[idx] = { ...copy[idx], qty: next };
    return { lines: copy };
  }
  if (!offline && p.availableBase <= 0) {
    return { lines: prev, error: "This product is out of stock" };
  }
  const initialQty = offline
    ? 1
    : clampQuantityToStock(1, p.saleUnit, p.availableBase, p.basePerSaleUnit);
  const unit = preferredMeasurementUnit(
    p.baseUnit ?? defaultBaseMetadata(p.saleUnit).baseUnit,
    p.basePerSaleUnit,
    p.saleUnit,
  );
  return {
    lines: [
      ...prev,
      {
        key: newUuid(),
        product: p,
        qty: initialQty,
        saleUnit: p.saleUnit,
        baseUnit: p.baseUnit,
        basePerSaleUnit: p.basePerSaleUnit,
        measurementUnit: unit,
        measurementValue: measurementValue(p.basePerSaleUnit, unit),
        unitPricePaise: p.basePricePaise,
        discountPaise: 0,
      },
    ],
  };
}

export function setLineQty(
  prev: CartLine[],
  key: string,
  qty: number,
  offline: boolean,
): CartLine[] {
  return prev.map((l) =>
    l.key === key
      ? {
          ...l,
          qty: offline
            ? Math.max(0, qty)
            : clampQuantityToStock(
                qty,
                l.saleUnit,
                l.product.availableBase,
                lineBasePerSaleUnit(l),
              ),
        }
      : l,
  );
}

export function setLineUnit(
  prev: CartLine[],
  key: string,
  unit: SaleUnit,
  offline: boolean,
): CartLine[] {
  return prev.map((l) =>
    l.key === key
      ? {
          ...l,
          saleUnit: unit,
          qty: offline
            ? l.qty
            : clampQuantityToStock(l.qty, unit, l.product.availableBase, lineBasePerSaleUnit(l)),
        }
      : l,
  );
}

export function setLineMeasurementValue(
  prev: CartLine[],
  key: string,
  unit: MeasurementUnit,
  value: number,
): CartLine[] {
  if (!Number.isFinite(value) || value <= 0) return prev;
  const metadata = measurementMetadata(unit);
  const basePerSaleUnit = Math.round(value * metadata.factor);
  if (!Number.isInteger(basePerSaleUnit) || basePerSaleUnit <= 0) return prev;
  return prev.map((l) =>
    l.key === key && metadata.baseUnit === lineBaseUnit(l)
      ? {
          ...l,
          baseUnit: metadata.baseUnit,
          basePerSaleUnit,
          measurementUnit: unit,
          measurementValue: value,
        }
      : l,
  );
}

export function setLineMeasurementUnit(
  prev: CartLine[],
  key: string,
  unit: MeasurementUnit,
): CartLine[] {
  return prev.map((l) => {
    if (l.key !== key) return l;
    const metadata = measurementMetadata(unit);
    if (metadata.baseUnit !== lineBaseUnit(l)) return l;
    return {
      ...l,
      measurementUnit: unit,
      measurementValue: measurementValue(lineBasePerSaleUnit(l), unit),
    };
  });
}

export function setLinePrice(prev: CartLine[], key: string, rupees: number): CartLine[] {
  if (!Number.isFinite(rupees) || rupees < 0) return prev;
  return prev.map((l) =>
    l.key === key ? { ...l, unitPricePaise: Math.round(rupees * 100), priceOverridden: true } : l,
  );
}

export function removeLine(prev: CartLine[], key: string): CartLine[] {
  return prev.filter((l) => l.key !== key);
}
