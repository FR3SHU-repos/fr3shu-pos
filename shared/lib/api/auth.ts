import { goRequest, type ApiResult } from "./client";
import type { PosRole, SellerOrgType } from "@/shared/lib/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: PosRole;
  orgId: string;
  orgType: SellerOrgType | "Platform";
  locationId: string;
}

// Identity is Supabase Auth (see shared/lib/supabase/*). The POS API keeps a
// profile echo at /pos/auth/me and a cookie-clear at /pos/auth/logout; login
// and registration are handled by Supabase, not here.

export const me = (accessToken?: string): Promise<ApiResult<SessionUser>> =>
  goRequest<SessionUser>("auth/me", {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

export const logout = async (): Promise<ApiResult<null>> => {
  const { createAuthBrowserClient } = await import("@/shared/lib/supabase/auth-client");
  const { error } = await createAuthBrowserClient().auth.signOut({ scope: "local" });
  const serverLogout = await fetch("/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);

  // Keep compatibility with older API cookie sessions without letting that
  // optional cleanup prevent the Supabase session from being cleared.
  void goRequest<null>("auth/logout", { method: "POST" });

  if (error && !serverLogout?.ok) {
    return { success: false, message: "Unable to clear the session.", data: null, status: 0 };
  }
  return { success: true, message: "Signed out", data: null, status: 200 };
};
