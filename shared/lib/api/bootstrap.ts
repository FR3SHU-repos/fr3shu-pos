import { request, type ApiResult } from "./client";
import type { SessionUser } from "./auth";
import type { Capabilities } from "./identity";
import type { MyOrganization } from "./sellerOrgs";
export interface PosBootstrap { user: SessionUser; capabilities: Capabilities; organization?: MyOrganization }
export const load = (): Promise<ApiResult<PosBootstrap>> => request<PosBootstrap>("pos/bootstrap");
