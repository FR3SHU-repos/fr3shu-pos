import mongoose, { Schema, type Model } from "mongoose";
import type { ILocation } from "@/shared/interfaces/mongodb/identity/location";

const AddressSchema = new Schema(
  { line1: String, line2: String, city: String, state: String, postalCode: String },
  { _id: false },
);

const LocationSchema = new Schema<ILocation>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    address: { type: AddressSchema, default: undefined },
    gstin: String,
  },
  { timestamps: true },
);

LocationSchema.index({ orgId: 1, code: 1 }, { unique: true });

const LocationModel: Model<ILocation> =
  mongoose.models.Location || mongoose.model<ILocation>("Location", LocationSchema);
export default LocationModel;
