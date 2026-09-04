import mongoose, { Schema, type Model } from "mongoose";
import type { IPayment } from "@/shared/interfaces/mongodb/pos/payment";

const PaymentSchema = new Schema<IPayment>(
  {
    orgId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    saleId: { type: String, required: true, index: true },
    method: { type: String, enum: ["cash", "upi", "card"], required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    upiRef: String,
    recordedBy: { type: String, required: true },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

PaymentSchema.index({ orgId: 1, sessionId: 1, recordedAt: -1 });

const PaymentModel: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
export default PaymentModel;
