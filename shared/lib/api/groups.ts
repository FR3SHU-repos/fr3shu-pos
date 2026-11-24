import { request, type ApiResult } from "./client";

export type GroupRole = "owner" | "manager" | "cashier" | "inventory_manager" | string;

export interface GroupSummary {
  groupId: string;
  organizationId: string;
  name: string;
  status: string;
  membershipId: string;
  membershipStatus: string;
  roles: GroupRole[];
  locationId?: string;
}

export interface GroupInvitation {
  id: string;
  code?: string;
  codeHint?: string;
  status: string;
  expiresAt: string;
  useCount?: number;
  maxUses?: number | null;
}

export interface GroupJoinRequest {
  groupName?: string;
  id: string;
  organizationId: string;
  requesterName: string;
  requestedRole: string;
  source: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
}

export interface GroupMember {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  status: string;
  roles: string[];
  createdAt: string;
}

export interface CreateGroupBody {
  name: string;
  legalName?: string;
  sellerType?: string;
  timezone?: string;
  address?: Record<string, string>;
}

export const list = (): Promise<ApiResult<{ items: GroupSummary[] }>> => request("seller-groups");

export const history = () => request<{ items: GroupSummary[] }>("seller-groups/history");
export const myRequests = () => request<{ items: GroupJoinRequest[] }>("me/group-join-requests");
export const close = (id: string) =>
  request<GroupSummary>(`seller-groups/${id}/close`, {
    method: "POST",
    body: {},
    idempotencyKey: crypto.randomUUID(),
  });

export const create = (body: CreateGroupBody): Promise<ApiResult<GroupSummary>> =>
  request("seller-groups", { method: "POST", body, idempotencyKey: crypto.randomUUID() });

export const sellerCode = (): Promise<ApiResult<{ code: string; active: boolean }>> =>
  request("me/seller-code");

export const rotateSellerCode = (): Promise<ApiResult<{ code: string; active: boolean }>> =>
  request("me/seller-code/rotate", { method: "POST" });

export const invitations = (groupId: string): Promise<ApiResult<{ items: GroupInvitation[] }>> =>
  request(`seller-groups/${groupId}/invitations`);

export const createInvitation = (
  groupId: string,
  body: { expiresInHours?: number; maxUses?: number },
): Promise<ApiResult<GroupInvitation>> =>
  request(`seller-groups/${groupId}/invitations`, {
    method: "POST",
    body,
    idempotencyKey: crypto.randomUUID(),
  });

export const revokeInvitation = (groupId: string, invitationId: string): Promise<ApiResult<null>> =>
  request(`seller-groups/${groupId}/invitations/${invitationId}`, { method: "DELETE" });

export const resolveInvitation = (code: string): Promise<ApiResult<{ groupName: string }>> =>
  request(`group-invitations/${encodeURIComponent(code)}`);

export const requestJoin = (code: string, role = "cashier"): Promise<ApiResult<GroupJoinRequest>> =>
  request("group-invitations/request", {
    method: "POST",
    body: { code, role },
    idempotencyKey: crypto.randomUUID(),
  });

export const requestJoinBySellerCode = (
  sellerCodeValue: string,
  organizationId: string,
  requestedRole = "cashier",
): Promise<ApiResult<GroupJoinRequest>> =>
  request("seller-codes/request", {
    method: "POST",
    body: { sellerCode: sellerCodeValue, organizationId, requestedRole },
    idempotencyKey: crypto.randomUUID(),
  });

export const members = (groupId: string): Promise<ApiResult<{ items: GroupMember[] }>> =>
  request(`seller-groups/${groupId}/members`);

export const joinRequests = (groupId: string): Promise<ApiResult<{ items: GroupJoinRequest[] }>> =>
  request(`seller-groups/${groupId}/join-requests`);

export const decideJoinRequest = (
  groupId: string,
  requestId: string,
  decision: "approve" | "reject",
  body: { role?: string; reason?: string } = {},
): Promise<ApiResult<Record<string, unknown>>> =>
  request(`seller-groups/${groupId}/join-requests/${requestId}/${decision}`, {
    method: "POST",
    body,
    idempotencyKey: crypto.randomUUID(),
  });

export const removeMember = (groupId: string, memberId: string): Promise<ApiResult<null>> =>
  request(`seller-groups/${groupId}/members/${memberId}/remove`, { method: "POST" });

export const leave = (groupId: string): Promise<ApiResult<null>> =>
  request(`seller-groups/${groupId}/leave`, { method: "POST" });
