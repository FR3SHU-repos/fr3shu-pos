import { goRequest, type ApiResult } from "./client";
import { mapRegister, mapShift, type GoRegisterRow, type GoShift, type RegisterDTO, type SessionDTO } from "./_map";

export type { RegisterDTO, SessionDTO };

export interface RegisterSessionsView {
  registers: RegisterDTO[];
  currentSession: SessionDTO | null;
  recentSessions: SessionDTO[];
}

export const overview = async (): Promise<ApiResult<RegisterSessionsView>> => {
  const [regsRes, shiftsRes] = await Promise.all([
    goRequest<{ items: GoRegisterRow[] }>("registers"),
    goRequest<{ items: GoShift[] }>("shifts", { query: { status: "closed", limit: 10 } }),
  ]);
  if (!regsRes.success || !regsRes.data) {
    return { ...regsRes, data: null };
  }
  const rows = regsRes.data.items ?? [];
  const openRow = rows.find((r) => r.currentShift && r.currentShift.status === "open");
  return {
    success: true,
    message: regsRes.message,
    status: regsRes.status,
    data: {
      registers: rows.map((r) => mapRegister(r.register)),
      currentSession: openRow?.currentShift ? mapShift(openRow.currentShift) : null,
      recentSessions: (shiftsRes.data?.items ?? []).map(mapShift),
    },
  };
};

export const open = async (body: {
  registerId: string;
  openingCashPaise: number;
}): Promise<ApiResult<SessionDTO>> => {
  const key = `open:${body.registerId}:${Date.now()}`;
  const res = await goRequest<GoShift>(`registers/${body.registerId}/open`, {
    method: "POST",
    body: { openingCashMinor: body.openingCashPaise, idempotencyKey: key },
    idempotencyKey: key,
  });
  return { ...res, data: res.data ? mapShift(res.data) : null };
};

export const close = async (
  registerId: string,
  body: { countedCashPaise: number; varianceNote?: string },
): Promise<ApiResult<SessionDTO>> => {
  const key = `close:${registerId}:${Date.now()}`;
  const res = await goRequest<GoShift>(`registers/${registerId}/close`, {
    method: "POST",
    body: {
      countedCashMinor: body.countedCashPaise,
      note: body.varianceNote,
      idempotencyKey: key,
    },
    idempotencyKey: key,
  });
  return { ...res, data: res.data ? mapShift(res.data) : null };
};
