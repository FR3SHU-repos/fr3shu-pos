import mongoose, { Schema, type Model } from "mongoose";
import type { ISellerOrganization } from "@/shared/interfaces/mongodb/identity/sellerOrganization";

const SettlementSchema = new Schema(
  {
    bankAccountName: String,
    bankAccountNumber: String,
    ifsc: String,
    upiId: String,
  },
  { _id: false },
);

const SellerOrganizationSchema = new Schema<ISellerOrganization>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Brand", "FPO", "Farmer"], required: true, index: true },
    status: {
      type: String,
      enum: ["PendingVerification", "Approved", "Suspended", "Archived"],
      default: "PendingVerification",
      index: true,
    },
    legalName: String,
    gstin: String,
    contactEmail: String,
    contactPhone: String,
    settlement: { type: SettlementSchema, default: undefined },
    verifiedBy: String,
    verifiedAt: Date,
  },
  { timestamps: true },
);

const SellerOrganizationModel: Model<ISellerOrganization> =
  mongoose.models.SellerOrganization ||
  mongoose.model<ISellerOrganization>("SellerOrganization", SellerOrganizationSchema);
export default SellerOrganizationModel;
