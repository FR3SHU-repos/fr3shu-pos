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

export interface RegOption {
  type: string;
  label: string;
  group: string;
  requiresApproval: boolean;
  needs?: string[];
}

export interface RegistrationOptions {
  app: string;
  options: RegOption[];
  warehouseSubRoles: string[];
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  type: string;
  orgName?: string;
}

export interface RegisterResult {
  id: string;
  email: string;
  type: string;
  pendingApproval: boolean;
}

// The registration catalogue is owned by go-api-backend and shared by every
// FR3SH app; this fetches only the types a POS user may pick.
export const registrationOptions = (): Promise<ApiResult<RegistrationOptions>> =>
  goRequest<RegistrationOptions>("auth/registration-options", { query: { app: "pos" } });

export const register = (input: RegisterInput): Promise<ApiResult<RegisterResult>> =>
  goRequest<RegisterResult>("auth/register", { method: "POST", body: { app: "pos", ...input } });
