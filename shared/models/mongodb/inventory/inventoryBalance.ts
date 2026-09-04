import mongoose, { Schema, type Model } from "mongoose";
import type { IInventoryBalance } from "@/shared/interfaces/mongodb/inventory/inventoryBalance";

const InventoryBalanceSchema = new Schema<IInventoryBalance>(
  {
    orgId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    lotId: { type: String, required: true, index: true },
    availableBase: { type: Number, required: true, default: 0, min: 0 },
    reservedBase: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

// One balance row per (location, product, lot). Also the atomic-decrement target.
InventoryBalanceSchema.index(
  { locationId: 1, productId: 1, lotId: 1 },
  { unique: true },
);
InventoryBalanceSchema.index({ orgId: 1, locationId: 1, productId: 1 });

const InventoryBalanceModel: Model<IInventoryBalance> =
  mongoose.models.InventoryBalance ||
  mongoose.model<IInventoryBalance>("InventoryBalance", InventoryBalanceSchema);
export default InventoryBalanceModel;
