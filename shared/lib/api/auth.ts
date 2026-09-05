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

// go-api-backend owns POS staff authentication at /api/v1/pos/auth/*. Calls are
// relayed through this app's same-origin proxy so the httpOnly pos_token cookie
// is set and sent.

export const login = (email: string, password: string): Promise<ApiResult<SessionUser>> =>
  goRequest<SessionUser>("auth/login", { method: "POST", body: { email, password } });

export const logout = (): Promise<ApiResult<null>> =>
  goRequest<null>("auth/logout", { method: "POST" });

export const me = (): Promise<ApiResult<SessionUser>> => goRequest<SessionUser>("auth/me");
