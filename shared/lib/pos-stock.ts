import { fromBaseQuantity, toBaseQuantity, type SaleUnit } from "@/shared/lib/units";

export function cartQuantityBase(quantity: number, unit: SaleUnit): number {
  return toBaseQuantity(Math.max(0, quantity), unit);
}

export function remainingStockBase(availableBase: number, quantity: number, unit: SaleUnit): number {
  return Math.max(0, availableBase - cartQuantityBase(quantity, unit));
}

export function clampQuantityToStock(quantity: number, unit: SaleUnit, availableBase: number): number {
  const maximum = fromBaseQuantity(Math.max(0, availableBase), unit);
  return Math.max(0, Math.min(Number(quantity.toFixed(3)), maximum));
}
