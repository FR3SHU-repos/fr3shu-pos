import type { SaleUnit } from "@/shared/lib/units";
import type { CertificationSnapshot } from "@/shared/interfaces/mongodb/catalog/certification";

export type LotStatus = "active" | "quarantined" | "expired" | "consumed";

export interface ILot {
  _id?: string;

  // Tenant
  orgId: string;

  // Required
  productId: string;
  lotCode: string;
  /** Total quantity received, in integer base units. */
  receivedBase: number;
  receivedUnit: SaleUnit;
  status: LotStatus;

  // Source / traceability
  farmOrProducerId?: string;
  producerName?: string;
  fpoName?: string;

  // Dates
  harvestDate?: Date;
  manufactureDate?: Date;
  packingDate?: Date;
  expiryDate?: Date;

  // Organic snapshot taken when the lot was received
  certificationSnapshot?: CertificationSnapshot;

  receivedBy?: string;
  receivedAtLocationId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
