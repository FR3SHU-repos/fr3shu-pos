import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, type PosRole, type PosTokenPayload } from "@/shared/lib/auth";
import { failure } from "./responses";

export class GuardError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve the caller's session from the httpOnly cookie.
 * Throws GuardError(401) when there is no valid session.
 * The tenant scope (orgId / locationId) always comes from here — never from the
 * request body or query string.
 */
export function requireSession(req: NextRequest): PosTokenPayload {
  const session = getSessionFromRequest(req);
  if (!session) throw new GuardError("Unauthorized", 401);
  return session;
}

/** Throws GuardError(403) when the session role is not in `allowed`. */
export function requireRole(session: PosTokenPayload, allowed: PosRole[]): void {
  if (!allowed.includes(session.role)) {
    throw new GuardError("You do not have permission to perform this action", 403);
  }
}

/**
 * A tenant filter fragment for Mongoose queries. Platform Admins (no orgId) are
 * not scoped; every other role is hard-scoped to their organisation.
 */
export function tenantFilter(session: PosTokenPayload): Record<string, unknown> {
  if (session.role === "Admin" && !session.orgId) return {};
  return { orgId: session.orgId };
}

/** Convert a thrown GuardError (or anything else) into a JSON response. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof GuardError) {
    return NextResponse.json(failure(err.message), { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[api] unhandled:", message);
  return NextResponse.json(failure("Internal server error", message), { status: 500 });
}
