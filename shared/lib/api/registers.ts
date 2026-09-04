import { request, type ApiResult } from "./client";
import type { IPosRegister } from "@/shared/interfaces/mongodb/pos/posRegister";
import type { IPosSession } from "@/shared/interfaces/mongodb/pos/posSession";
import type { OpenRegisterInput, CloseRegisterInput } from "@/shared/schemas/register";

export type RegisterDTO = IPosRegister & { _id: string };
export type SessionDTO = IPosSession & { _id: string };

export interface RegisterSessionsView {
  registers: RegisterDTO[];
  currentSession: SessionDTO | null;
  recentSessions: SessionDTO[];
}

export const overview = (): Promise<ApiResult<RegisterSessionsView>> =>
  request<RegisterSessionsView>("/register-sessions");

export const open = (body: OpenRegisterInput): Promise<ApiResult<SessionDTO>> =>
  request<SessionDTO>("/register-sessions/open", { method: "POST", body });

export const close = (
  id: string,
  body: CloseRegisterInput,
): Promise<ApiResult<SessionDTO>> =>
  request<SessionDTO>(`/register-sessions/${id}/close`, { method: "POST", body });
