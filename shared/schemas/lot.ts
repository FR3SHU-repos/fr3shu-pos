import { z } from "zod";
import { saleUnitEnum, baseQty } from "./common";

export const receiveLotSchema = z.object({
  productId: z.string().min(1),
  lotCode: z.string().min(1).max(64),
  /** Received quantity in integer base units (grams / ml / count). */
  receivedBase: baseQty,
  receivedUnit: saleUnitEnum,
  locationId: z.string().min(1),
  producerName: z.string().max(160).optional(),
  fpoName: z.string().max(160).optional(),
  farmOrProducerId: z.string().optional(),
  harvestDate: z.string().datetime().optional(),
  packingDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type ReceiveLotInput = z.infer<typeof receiveLotSchema>;
