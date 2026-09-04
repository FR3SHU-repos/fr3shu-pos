import mongoose, { Schema, type Model } from "mongoose";
import type { IStockMovement } from "@/shared/interfaces/mongodb/inventory/stockMovement";

const StockMovementSchema = new Schema<IStockMovement>(
  {
    orgId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    lotId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["opening", "receipt", "sale", "return", "transfer", "wastage", "correction"],
      required: true,
      index: true,
    },
    deltaBase: { type: Number, required: true },
    balanceAfterBase: { type: Number },
    refType: { type: String, enum: ["Sale", "Lot", "Return", "Adjustment"] },
    refId: { type: String, index: true },
    actorId: String,
    reasonCode: String,
    note: String,
    requestId: String,
  },
  { timestamps: true },
);

StockMovementSchema.index({ orgId: 1, locationId: 1, createdAt: -1 });
StockMovementSchema.index({ productId: 1, lotId: 1, createdAt: -1 });

const StockMovementModel: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);
export default StockMovementModel;
