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

export const me = (): Promise<ApiResult<SessionUser>> =>
  goRequest<SessionUser>("auth/me");

export const logout = (): Promise<ApiResult<null>> =>
  goRequest<null>("auth/logout", { method: "POST" });
