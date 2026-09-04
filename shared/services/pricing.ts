import { computeLineTotals, sumCartTotals, type CartTotals, type LineTotals } from "@/shared/lib/money";
import type { IProduct } from "@/shared/interfaces/mongodb/catalog/product";
import type { IProductPrice } from "@/shared/interfaces/mongodb/catalog/productPrice";

/**
 * Resolve the authoritative unit price (paise) for one product at one location.
 * Order of precedence:
 *   1. active, in-window ProductPrice for that location (most recent effectiveFrom)
 *   2. product.basePricePaise fallback
 * Throws when neither exists — a product with no price must not be sellable.
 */
export function resolveUnitPricePaise(
  product: Pick<IProduct, "_id" | "name" | "basePricePaise">,
  locationPrices: IProductPrice[],
  at: Date = new Date(),
): number {
  const candidates = locationPrices
    .filter((p) => String(p.productId) === String(product._id))
    .filter((p) => p.isActive)
    .filter((p) => new Date(p.effectiveFrom).getTime() <= at.getTime())
    .filter((p) => !p.effectiveTo || new Date(p.effectiveTo).getTime() > at.getTime())
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  if (candidates[0]) return candidates[0].unitPricePaise;
  if (typeof product.basePricePaise === "number") return product.basePricePaise;

  throw new Error(`No active price for product "${product.name}"`);
}

export interface PricedLine {
  unitPricePaise: number;
  taxRateBps: number;
  totals: LineTotals;
}

/** Compute one line's money using server-approved price + tax. Client amounts are ignored. */
export function priceSaleLine(args: {
  product: Pick<IProduct, "_id" | "name" | "basePricePaise" | "taxRateBps" | "basePerSaleUnit">;
  locationPrices: IProductPrice[];
  qtyBase: number;
  discountPaise?: number;
  at?: Date;
}): PricedLine {
  const unitPricePaise = resolveUnitPricePaise(args.product, args.locationPrices, args.at);
  const taxRateBps = args.product.taxRateBps ?? 0;
  const totals = computeLineTotals({
    qtyBase: args.qtyBase,
    unitPricePaise,
    basePerSaleUnit: args.product.basePerSaleUnit,
    taxRateBps,
    discountPaise: args.discountPaise,
  });
  return { unitPricePaise, taxRateBps, totals };
}

export function priceCart(lines: LineTotals[], cartDiscountPaise = 0): CartTotals {
  return sumCartTotals(lines, cartDiscountPaise);
}
