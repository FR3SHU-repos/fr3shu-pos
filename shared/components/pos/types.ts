import type { BaseUnit, MeasurementUnit, SaleUnit } from "@/shared/lib/units";
import type { ProductDTO } from "@/shared/lib/api/products";

export interface CartLine {
  key: string;
  product: ProductDTO;
  qty: number;
  saleUnit: SaleUnit;
  /** Checkout-time pack measurement; omitted means use the product default. */
  baseUnit?: BaseUnit;
  basePerSaleUnit?: number;
  measurementUnit?: MeasurementUnit;
  measurementValue?: number;
  unitPricePaise?: number;
  priceOverridden?: boolean;
  discountPaise: number;
}

export interface HeldCart {
  id: string;
  label: string;
  savedAt: string;
  lines: Array<{
    productId: string;
    qty: number;
    saleUnit: SaleUnit;
    baseUnit?: BaseUnit;
    basePerSaleUnit?: number;
    measurementUnit?: MeasurementUnit;
    measurementValue?: number;
    unitPricePaise?: number;
    priceOverridden?: boolean;
    discountPaise: number;
  }>;
}
