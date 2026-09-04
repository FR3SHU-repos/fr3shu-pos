import mongoose, { Schema, type Model } from "mongoose";
import type { IPosRegister } from "@/shared/interfaces/mongodb/pos/posRegister";

const PosRegisterSchema = new Schema<IPosRegister>(
  {
    orgId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true },
);

PosRegisterSchema.index({ orgId: 1, locationId: 1, code: 1 }, { unique: true });

const PosRegisterModel: Model<IPosRegister> =
  mongoose.models.PosRegister ||
  mongoose.model<IPosRegister>("PosRegister", PosRegisterSchema);
export default PosRegisterModel;
