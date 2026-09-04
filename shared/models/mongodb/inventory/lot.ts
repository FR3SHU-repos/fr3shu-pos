import mongoose, { Schema, type Model } from "mongoose";
import type { ILot } from "@/shared/interfaces/mongodb/inventory/lot";

const CertSnapshotSchema = new Schema(
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

const LotSchema = new Schema<ILot>(
  {
    orgId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    lotCode: { type: String, required: true, trim: true },
    receivedBase: { type: Number, required: true, min: 0 },
    receivedUnit: {
      type: String,
      enum: ["kg", "g", "l", "ml", "piece", "bunch", "pack"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "quarantined", "expired", "consumed"],
      default: "active",
      index: true,
    },
    farmOrProducerId: String,
    producerName: String,
    fpoName: String,
    harvestDate: Date,
    manufactureDate: Date,
    packingDate: Date,
    expiryDate: { type: Date, index: true },
    certificationSnapshot: { type: CertSnapshotSchema, default: undefined },
    receivedBy: String,
    receivedAtLocationId: { type: String, index: true },
  },
  { timestamps: true },
);

LotSchema.index({ orgId: 1, productId: 1, lotCode: 1 }, { unique: true });
LotSchema.index({ orgId: 1, productId: 1, status: 1, expiryDate: 1 });

const LotModel: Model<ILot> = mongoose.models.Lot || mongoose.model<ILot>("Lot", LotSchema);
export default LotModel;
