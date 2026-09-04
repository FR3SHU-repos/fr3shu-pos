import { z } from "zod";
import { saleUnitEnum, paise } from "./common";

export const saleItemInputSchema = z.object({
  productId: z.string().min(1),
  /** Quantity in the chosen sale unit (may be fractional, e.g. 1.5 kg). */
  qty: z.number().positive().max(100000),
  saleUnit: saleUnitEnum,
  /** Optional explicit lot. If omitted the server picks FEFO. */
  lotId: z.string().optional(),
  /** Optional per-line discount in paise. Server clamps to the line gross. */
  discountPaise: paise.optional(),
  /** Required (with a reason) when lotId overrides the FEFO pick. */
  lotOverrideReason: z.string().max(300).optional(),
});

export const paymentInputSchema = z.object({
  method: z.enum(["cash", "upi", "card"]),
  amountPaise: paise.refine((v) => v > 0, "Payment amount must be > 0"),
  upiRef: z.string().max(120).optional(),
});

export const createSaleSchema = z.object({
  /** Client-generated. Retries with the same key return the original sale. */
  idempotencyKey: z.string().min(8).max(120),
  /** Optional — server falls back to the caller's current open session. */
  sessionId: z.string().optional(),
  items: z.array(saleItemInputSchema).min(1, "At least one item is required"),
  payments: z.array(paymentInputSchema).min(1, "At least one payment is required"),
  cartDiscountPaise: paise.optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z
    .string()
    .regex(/^[0-9+\-\s]{6,20}$/, "Invalid phone")
    .optional(),
  marketingConsent: z.boolean().optional(),
  deviceId: z.string().max(120).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
