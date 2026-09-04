import mongoose, { Schema, type Model } from "mongoose";
import type { IProduct } from "@/shared/interfaces/mongodb/catalog/product";

const ProductSchema = new Schema<IProduct>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    saleUnit: {
      type: String,
      enum: ["kg", "g", "l", "ml", "piece", "bunch", "pack"],
      required: true,
    },
    baseUnit: { type: String, enum: ["g", "ml", "count"], required: true },
    basePerSaleUnit: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    certificationId: { type: String, index: true },
    organicStatus: {
      type: String,
      enum: [
        "Verified",
        "InConversion",
        "PendingVerification",
        "Expired",
        "Rejected",
        "NotOrganic",
      ],
      default: "PendingVerification",
      index: true,
    },
    barcode: { type: String, index: true },
    categoryId: { type: String, index: true },
    description: String,
    images: { type: [String], default: [] },
    taxRateBps: { type: Number, default: 0, min: 0 },
    basePricePaise: { type: Number, min: 0 },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ProductSchema.index({ orgId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ orgId: 1, barcode: 1 });
ProductSchema.index({ orgId: 1, status: 1, name: 1 });

const ProductModel: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
export default ProductModel;
