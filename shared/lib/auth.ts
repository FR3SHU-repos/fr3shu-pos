import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

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

const cookieMaxAge = (): number => Number(process.env.JWT_COOKIE_MAX_AGE ?? 28800);

export function signToken(payload: PosTokenPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "8h",
  });
}

export function verifyTokenString(token: string): PosTokenPayload | null {
  try {
    return jwt.verify(token, getSecret()) as PosTokenPayload;
  } catch {
    return null;
  }
}

/** Read the session from a server component / route via the cookie store. */
export async function getSession(): Promise<PosTokenPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyTokenString(token);
}

/** Read the session directly from a NextRequest (route handlers). */
export function getSessionFromRequest(req: NextRequest): PosTokenPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyTokenString(token);
}

export function makeAuthCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: cookieMaxAge(),
    path: "/",
  };
}

export function clearAuthCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
