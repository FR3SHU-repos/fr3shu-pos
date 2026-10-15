import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or mobile number is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
