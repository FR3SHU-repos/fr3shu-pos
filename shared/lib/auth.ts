import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export type PosRole = "Admin" | "Owner" | "Manager" | "Cashier" | "InventoryManager";
export type SellerOrgType = "Brand" | "FPO" | "Farmer";

export interface PosTokenPayload {
  /** User _id */
  sub: string;
  email: string;
  name: string;
  role: PosRole;
  /** Seller organisation scope. Empty string for a platform Admin with no org. */
  orgId: string;
  orgType: SellerOrgType | "Platform";
  /** Default assigned location; may be overridden per-session within the same org. */
  locationId: string;
}

const COOKIE_NAME = "pos_token";
const FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

// Token signing and cookie issuance now live in go-api-backend (`posauth`); the
// login route here is a database-free proxy that relays Go's Set-Cookie. This
// app only *verifies* the `pos_token` cookie for the SSR redirect on "/".

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is not set.");
    }
    return FALLBACK_SECRET;
  }
  return secret;
};

export function verifyTokenString(token: string): PosTokenPayload | null {
  try {
    return jwt.verify(token, getSecret()) as PosTokenPayload;
  } catch {
    return null;
  }
}

/** Read the session from a server component via the cookie store. */
export async function getSession(): Promise<PosTokenPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyTokenString(token);
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
