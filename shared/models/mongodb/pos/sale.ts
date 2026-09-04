import mongoose, { Schema, type Model } from "mongoose";
import type { ISale } from "@/shared/interfaces/mongodb/pos/sale";

const OrganicSnapshotSchema = new Schema(
  {
    certificationId: String,
    scheme: String,
    verificationStatus: String,
    certificateNumber: String,
    certifyingBody: String,
    validUntil: Date,
    isVerifiedOrganic: { type: Boolean, default: false },
  },
  { _id: false },
);

const SaleItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    lotId: { type: String, required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    barcode: String,
    saleUnit: { type: String, required: true },
    qtyBase: { type: Number, required: true, min: 1 },
    basePerSaleUnit: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    grossPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, required: true, default: 0, min: 0 },
    taxRateBps: { type: Number, required: true, default: 0, min: 0 },
    taxPaise: { type: Number, required: true, default: 0, min: 0 },
    netPaise: { type: Number, required: true, min: 0 },
    organic: { type: OrganicSnapshotSchema, required: true },
  },
  { _id: false },
);

const SaleSchema = new Schema<ISale>(
  {
    orgId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    registerId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    receiptNo: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["completed", "partially_returned", "returned", "voided"],
      default: "completed",
      index: true,
    },
    items: { type: [SaleItemSchema], required: true },
    grossPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, required: true, default: 0, min: 0 },
    taxPaise: { type: Number, required: true, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    customerName: String,
    customerPhone: { type: String, index: true },
    marketingConsent: { type: Boolean, default: false },
    cashierId: { type: String, required: true, index: true },
    soldAt: { type: Date, required: true, default: Date.now, index: true },
    syncState: { type: String, enum: ["synced", "pending", "conflict"], default: "synced" },
    deviceId: String,
  },
  { timestamps: true },
);

SaleSchema.index({ orgId: 1, locationId: 1, soldAt: -1 });
SaleSchema.index({ orgId: 1, receiptNo: 1 }, { unique: true });

const SaleModel: Model<ISale> =
  mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema);
export default SaleModel;
