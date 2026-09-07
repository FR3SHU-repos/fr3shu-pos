/** Append-only ledger of every quantity change. Never updated in place. */
export type StockMovementType =
  | "opening"
  | "receipt"
  | "sale"
  | "return"
  | "transfer"
  | "wastage"
  | "correction";

export interface IStockMovement {
  _id?: string;

  orgId: string;
  locationId: string;
  productId: string;
  lotId: string;

  type: StockMovementType;
  /** Signed change in base units: negative for sale/wastage, positive for receipt/return. */
  deltaBase: number;
  /** Resulting availableBase after this movement (best-effort snapshot). */
  balanceAfterBase?: number;

  // Links
  refType?: "Sale" | "Lot" | "Return" | "Adjustment";
  refId?: string;

  actorId?: string;
  reasonCode?: string;
  note?: string;
  requestId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
