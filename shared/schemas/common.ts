import { z } from "zod";

export const saleUnitEnum = z.enum(["kg", "g", "l", "ml", "piece", "bunch", "pack"]);
export const baseUnitEnum = z.enum(["g", "ml", "count"]);

/** A positive integer amount in paise. */
export const paise = z.number().int().nonnegative();

/** A positive integer base quantity (grams / millilitres / count). */
export const baseQty = z.number().int().positive();

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
