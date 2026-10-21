import type { NextRequest } from "next/server";
import { updateSession } from "@/shared/lib/supabase/middleware";

// Server-side Supabase session refresh + route guard.
// Next.js 16 calls this boundary proxy instead of middleware.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
