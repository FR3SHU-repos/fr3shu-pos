import { z } from "zod";
import { paise } from "./common";

export const openRegisterSchema = z.object({
  registerId: z.string().min(1),
  openingCashPaise: paise,
});

export const closeRegisterSchema = z.object({
  countedCashPaise: paise,
  varianceNote: z.string().max(500).optional(),
});

export type OpenRegisterInput = z.infer<typeof openRegisterSchema>;
export type CloseRegisterInput = z.infer<typeof closeRegisterSchema>;
