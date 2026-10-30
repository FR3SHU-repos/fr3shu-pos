"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { CartLine } from "@/shared/components/pos/types";
import { computeLineTotals, sumCartTotals } from "@/shared/lib/money";
import { toBaseQuantity, type MeasurementUnit, type SaleUnit } from "@/shared/lib/units";
import {
  addProductToLines,
  lineBasePerSaleUnit,
  lineUnitPricePaise,
  removeLine as removeLineFrom,
  setLineMeasurementUnit,
  setLineMeasurementValue,
  setLinePrice,
  setLineQty,
  setLineUnit,
} from "@/shared/lib/pos/cart-lines";

const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

/** Cart lines, their mutators and the derived (display-only) totals. The API stays authoritative for money. */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const lineTotals = useMemo(
    () =>
      lines.map((l) =>
        computeLineTotals({
          qtyBase: toBaseQuantity(l.qty, l.saleUnit, lineBasePerSaleUnit(l)),
          unitPricePaise: lineUnitPricePaise(l),
          basePerSaleUnit: lineBasePerSaleUnit(l),
          taxRateBps: l.product.taxRateBps ?? 0,
          discountPaise: l.discountPaise,
        }),
      ),
    [lines],
  );
  const totals = useMemo(() => sumCartTotals(lineTotals), [lineTotals]);

  return {
    lines,
    setLines,
    lineTotals,
    totals,
    addProduct(p: ProductDTO) {
      const offline = isOffline();
      setLines((prev) => {
        const result = addProductToLines(prev, p, offline);
        if (result.error) toast.error(result.error);
        return result.lines;
      });
    },
    setQty: (key: string, qty: number) => {
      const offline = isOffline();
      setLines((prev) => setLineQty(prev, key, qty, offline));
    },
    setUnit: (key: string, unit: SaleUnit) => {
      const offline = isOffline();
      setLines((prev) => setLineUnit(prev, key, unit, offline));
    },
    setMeasurementValue: (key: string, unit: MeasurementUnit, value: number) =>
      setLines((prev) => setLineMeasurementValue(prev, key, unit, value)),
    setMeasurementUnit: (key: string, unit: MeasurementUnit) =>
      setLines((prev) => setLineMeasurementUnit(prev, key, unit)),
    setPrice: (key: string, rupees: number) => setLines((prev) => setLinePrice(prev, key, rupees)),
    removeLine: (key: string) => setLines((prev) => removeLineFrom(prev, key)),
    clear: () => setLines([]),
  };
}

export type CartApi = ReturnType<typeof useCart>;
