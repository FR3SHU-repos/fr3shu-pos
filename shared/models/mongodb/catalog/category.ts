import mongoose, { Schema, type Model } from "mongoose";
import type { ICategory } from "@/shared/interfaces/mongodb/catalog/category";

const CategorySchema = new Schema<ICategory>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CategorySchema.index({ orgId: 1, slug: 1 }, { unique: true });

const CategoryModel: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);
export default CategoryModel;
