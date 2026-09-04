import type { SaleUnit } from "@/shared/lib/units";
import type { ProductDTO } from "@/shared/lib/api/products";

export interface CartLine {
  key: string;
  product: ProductDTO;
  qty: number;
  saleUnit: SaleUnit;
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
    discountPaise: number;
  }>;
}

export const HELD_CARTS_KEY = "fr3shu-pos:held-carts";
