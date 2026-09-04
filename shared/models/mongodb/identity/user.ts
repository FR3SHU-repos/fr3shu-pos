import mongoose, { Schema, type Model } from "mongoose";
import type { IUser } from "@/shared/interfaces/mongodb/identity/user";

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["Admin", "Owner", "Manager", "Cashier", "InventoryManager"],
      required: true,
      index: true,
    },
    orgId: { type: String, default: "", index: true },
    locationIds: { type: [String], default: [] },
    phoneNumber: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    invitedBy: { type: String },
  },
  { timestamps: true },
);

UserSchema.index({ orgId: 1, role: 1 });

const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default UserModel;
