import { goRequest, type ApiResult } from "./client";

export interface OfflinePreparationDTO {
  grantId: string;
  grantToken: string;
  registerId: string;
  terminalId: string;
  shiftId: string;
  issuedAt: string;
  expiresAt: string;
}

export const prepare = (body: { registerId: string; deviceId: string }): Promise<ApiResult<OfflinePreparationDTO>> =>
  goRequest<OfflinePreparationDTO>("offline/prepare", {
    method: "POST",
    body,
    idempotencyKey: `offline-prepare:${body.registerId}:${body.deviceId}`,
  });

export const revoke = (grantId: string): Promise<ApiResult<{ grantId: string; revoked: boolean }>> =>
  goRequest<{ grantId: string; revoked: boolean }>(`offline/grants/${grantId}/revoke`, {
    method: "POST",
  });
