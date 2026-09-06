import type { SessionUser } from "@/shared/lib/api/auth";

export const ADMIN_HOME = "/admin/seller-applications";

export function isPlatformAdmin(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === "Admin";
}
