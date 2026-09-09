import { goRequest, type ApiResult } from "./client";

export interface ResolvedBuyer {
  code: string;
  displayName: string;
  phone: string;
}

export const resolveBuyerCode = (code: string): Promise<ApiResult<ResolvedBuyer>> =>
  goRequest<ResolvedBuyer>("customers/resolve", { query: { code } });
