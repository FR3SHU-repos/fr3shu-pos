/**
 * Payment RECORDING only — no gateway integration in this phase.
 * A single Sale may have multiple Payment rows (split tender).
 */
export type PaymentMethod = "cash" | "upi" | "card";

export interface IPayment {
  _id?: string;

  orgId: string;
  locationId: string;
  sessionId: string;
  saleId: string;

  method: PaymentMethod;
  amountPaise: number;

  /** Operator-typed external UPI reference, if any. Not verified against any PSP. */
  upiRef?: string;

  recordedBy: string;
  recordedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
