import { z } from "zod";
import { saleUnitEnum, baseUnitEnum, paise } from "./common";

export const createProductSchema = z.object({
  name: z.string().min(2).max(160),
  sku: z.string().min(1).max(64),
  barcode: z.string().max(64).optional(),
  categoryId: z.string().optional(),
  description: z.string().max(2000).optional(),
  saleUnit: saleUnitEnum,
  baseUnit: baseUnitEnum,
  basePerSaleUnit: z.number().int().positive(),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
  basePricePaise: paise.optional(),
  certificationId: z.string().optional(),
  organicStatus: z
    .enum([
      "Verified",
      "InConversion",
      "PendingVerification",
      "Expired",
      "Rejected",
      "NotOrganic",
    ])
    .default("PendingVerification"),
  isPinned: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
