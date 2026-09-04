import type { SaleUnit } from "@/shared/lib/units";
import type { CertificationSnapshot } from "@/shared/interfaces/mongodb/catalog/certification";

export type SaleStatus = "completed" | "partially_returned" | "returned" | "voided";

/** Immutable snapshot of one sold line. Never mutated after the sale is written. */
export interface ISaleItem {
  productId: string;
  lotId: string;

  name: string;
  sku: string;
  barcode?: string;

  saleUnit: SaleUnit;
  /** Quantity sold in integer base units. */
  qtyBase: number;
  basePerSaleUnit: number;

  unitPricePaise: number;
  grossPaise: number;
  discountPaise: number;
  taxRateBps: number;
  taxPaise: number;
  netPaise: number;

  organic: CertificationSnapshot;
}

export interface ISale {
  _id?: string;

  // Tenant / context
  orgId: string;
  locationId: string;
  registerId: string;
  sessionId: string;

  receiptNo: string;
  /** Client-generated unique key; retries with the same key return the original sale. */
  idempotencyKey: string;

  status: SaleStatus;
  items: ISaleItem[];

  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;

  // Optional customer (counter sale needs none)
  customerName?: string;
  customerPhone?: string;
  marketingConsent?: boolean;

  cashierId: string;
  soldAt: Date;

  /** Sync bookkeeping for a later offline slice. "synced" for online sales. */
  syncState?: "synced" | "pending" | "conflict";
  deviceId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
