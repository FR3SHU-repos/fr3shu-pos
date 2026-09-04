import mongoose, { Schema, type Model } from "mongoose";
import type { IProductPrice } from "@/shared/interfaces/mongodb/catalog/productPrice";

const ProductPriceSchema = new Schema<IProductPrice>(
  {
    orgId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    unitPricePaise: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: String,
  },
  { timestamps: true },
);

// Fast "current price for this product at this location" lookup.
ProductPriceSchema.index({ productId: 1, locationId: 1, isActive: 1, effectiveFrom: -1 });

const ProductPriceModel: Model<IProductPrice> =
  mongoose.models.ProductPrice ||
  mongoose.model<IProductPrice>("ProductPrice", ProductPriceSchema);
export default ProductPriceModel;
