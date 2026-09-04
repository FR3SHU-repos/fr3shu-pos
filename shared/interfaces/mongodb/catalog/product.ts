import type { BaseUnit, SaleUnit } from "@/shared/lib/units";

export type ProductStatus = "active" | "inactive" | "archived";
export type OrganicStatus =
  | "Verified"
  | "InConversion"
  | "PendingVerification"
  | "Expired"
  | "Rejected"
  | "NotOrganic";

export interface IProduct {
  _id?: string;

  // Tenant
  orgId: string;

  // Required
  name: string;
  sku: string;
  saleUnit: SaleUnit;
  baseUnit: BaseUnit;
  /** base units per one sale unit (e.g. 1000 for kg). Denormalised for fast checkout. */
  basePerSaleUnit: number;
  status: ProductStatus;

  // Organic trust
  certificationId?: string;
  organicStatus: OrganicStatus;

  // Optional
  barcode?: string;
  categoryId?: string;
  description?: string;
  images?: string[];
  /** GST / tax rate in basis points (e.g. 500 = 5%). */
  taxRateBps?: number;
  /** Fallback price if no location ProductPrice row exists. */
  basePricePaise?: number;
  isPinned?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
