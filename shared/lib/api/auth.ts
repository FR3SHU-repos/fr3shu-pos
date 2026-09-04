import { request, type ApiResult } from "./client";
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

export const login = (email: string, password: string): Promise<ApiResult<SessionUser>> =>
  request<SessionUser>("/auth/login", { method: "POST", body: { email, password } });

export const logout = (): Promise<ApiResult<null>> =>
  request<null>("/auth/logout", { method: "POST" });

export const me = (): Promise<ApiResult<SessionUser>> => request<SessionUser>("/auth/me");
