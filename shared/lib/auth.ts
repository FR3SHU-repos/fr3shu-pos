import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export type PosRole =
  | "Admin"
  | "Owner"
  | "Manager"
  | "Cashier"
  | "InventoryManager"
  | "StoreOwner"
  | "StoreManager";
export type SellerOrgType = "Brand" | "FPO" | "Farmer";

// One FR3SH session token, shared by every app. This app only *verifies* the
// `token` cookie for the SSR redirect on "/"; issuance lives in go-api-backend.
export interface PosTokenPayload {
  sub: string;
  email: string;
  name: string;
  type: string;
  roles?: string[];
  role?: PosRole;
  orgId: string;
  orgType: SellerOrgType | "Platform";
  locationId: string;
}

const COOKIE_NAME = "token";
const FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

const POS_TYPES = new Set([
  "StoreOwner",
  "StoreManager",
  "Cashier",
  "Admin",
  "Owner",
  "Manager",
  "InventoryManager",
]);
const POS_ROLES = new Set([
  "Owner",
  "Manager",
  "Cashier",
  "InventoryManager",
  "StoreOwner",
  "StoreManager",
]);

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

function isPosIdentity(p: { type?: string; roles?: string[] }): boolean {
  if (p.type && POS_TYPES.has(p.type)) return true;
  return (p.roles ?? []).some((r) => POS_ROLES.has(r));
}

export function verifyTokenString(token: string): PosTokenPayload | null {
  try {
    const raw = jwt.verify(token, getSecret()) as Record<string, unknown>;
    const p: PosTokenPayload = {
      sub: String(raw.sub ?? ""),
      email: String(raw.email ?? ""),
      name: String(raw.name ?? ""),
      type: String(raw.type ?? ""),
      roles: (raw.roles as string[]) ?? undefined,
      role: raw.role ? (String(raw.role) as PosRole) : undefined,
      orgId: String(raw.orgId ?? ""),
      orgType: (String(raw.orgType ?? "Platform") as PosTokenPayload["orgType"]),
      locationId: String(raw.locationId ?? ""),
    };
    if (!p.sub || !isPosIdentity(p)) return null;
    return p;
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
