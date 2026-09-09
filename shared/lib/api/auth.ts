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
  const { error } = await createAuthBrowserClient().auth.signOut();
  if (error) return { success: false, message: error.message, data: null, status: 0 };
  return goRequest<null>("auth/logout", { method: "POST" });
};
