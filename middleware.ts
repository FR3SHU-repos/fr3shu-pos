import type { NextRequest } from "next/server";
import { updateSession } from "@/shared/lib/supabase/middleware";

// Server-side Supabase session refresh + route guard (replaces the SSR check in
// app/page.tsx / shared/lib/auth.ts).
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
