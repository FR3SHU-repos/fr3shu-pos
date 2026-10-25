import { fromBaseQuantity, toBaseQuantity, type SaleUnit } from "@/shared/lib/units";

export function cartQuantityBase(quantity: number, unit: SaleUnit, basePerSaleUnit?: number): number {
  return toBaseQuantity(Math.max(0, quantity), unit, basePerSaleUnit);
}

export function remainingStockBase(availableBase: number, quantity: number, unit: SaleUnit, basePerSaleUnit?: number): number {
  return Math.max(0, availableBase - cartQuantityBase(quantity, unit, basePerSaleUnit));
}

export function clampQuantityToStock(quantity: number, unit: SaleUnit, availableBase: number, basePerSaleUnit?: number): number {
  const maximum = fromBaseQuantity(Math.max(0, availableBase), unit, basePerSaleUnit);
  return Math.max(0, Math.min(Number(quantity.toFixed(3)), maximum));
}
