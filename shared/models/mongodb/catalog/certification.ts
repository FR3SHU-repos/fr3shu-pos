import mongoose, { Schema, type Model } from "mongoose";
import type { ICertification } from "@/shared/interfaces/mongodb/catalog/certification";

const HistorySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    note: String,
  },
  { _id: false },
);

const CertificationSchema = new Schema<ICertification>(
  {
    orgId: { type: String, required: true, index: true },
    scheme: {
      type: String,
      enum: [
        "NPOP",
        "PGSIndia",
        "InConversion",
        "OtherCertified",
        "PendingVerification",
        "Expired",
        "Rejected",
      ],
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: ["PendingVerification", "Approved", "Rejected", "Expired"],
      default: "PendingVerification",
      index: true,
    },
    farmOrProducerId: String,
    certificateNumber: String,
    certifyingBody: String,
    scope: String,
    coveredCategories: { type: [String], default: [] },
    issueDate: Date,
    validFrom: Date,
    validUntil: { type: Date, index: true },
    documentUrl: String,
    documentMeta: {
      type: new Schema(
        { filename: String, mimeType: String, sizeBytes: Number },
        { _id: false },
      ),
      default: undefined,
    },
    verifiedBy: String,
    verifiedAt: Date,
    verifierNotes: String,
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true },
);

CertificationSchema.index({ orgId: 1, verificationStatus: 1 });

const CertificationModel: Model<ICertification> =
  mongoose.models.Certification ||
  mongoose.model<ICertification>("Certification", CertificationSchema);
export default CertificationModel;
