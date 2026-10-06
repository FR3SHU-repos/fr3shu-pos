import { request, type ApiResult } from "./client";

export type PrivacyOpsStatus = "submitted" | "in_review" | "completed" | "rejected";
export type PrivacyRequestType = "access" | "correction" | "erasure" | "nomination" | "grievance";

export interface AdminPrivacyRequest {
  id: string;
  requestType: PrivacyRequestType;
  details: string;
  status: PrivacyOpsStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  assignedTo: string;
  identityVerifiedAt?: string | null;
  responseNote: string;
  person: { id: string; displayName: string; email: string; phone: string };
}

export interface AdminPrivacyRequestPage {
  items: AdminPrivacyRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function listAdminPrivacyRequests(status = "", page = 1): Promise<ApiResult<AdminPrivacyRequestPage>> {
  return request<AdminPrivacyRequestPage>("admin/privacy/requests", {
    query: { status: status || undefined, page: Math.max(1, page), limit: 25 },
  });
}

export function updateAdminPrivacyRequest(
  id: string,
  body: { status?: Exclude<PrivacyOpsStatus, "submitted">; identityVerified?: boolean; responseNote?: string },
): Promise<ApiResult<{ id: string; requestType: PrivacyRequestType; status: PrivacyOpsStatus }>> {
  return request(`admin/privacy/requests/${encodeURIComponent(id)}`, { method: "PATCH", body });
}
