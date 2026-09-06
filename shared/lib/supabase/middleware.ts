import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const PUBLIC_PREFIXES = ["/login", "/register", "/auth/"];

function safe(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

/** Refresh the Supabase session; gate everything except the public auth pages. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!URL || !KEY) return response;

  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return response;
  if (pathname.startsWith("/api/")) return response; // proxy relays its own auth

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (safe(pathname)) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // UX gate only; Go independently enforces administrative restrictions.
  if (!pathname.startsWith("/seller/") && pathname !== "/") {
    const { data: { session } } = await supabase.auth.getSession();
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
    if (base && session?.access_token) {
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const me = await fetch(`${base}/api/v1/pos/auth/me`, { headers, cache: "no-store" });
        if (!me.ok) return response;
        const profile = await me.json();
        if (isPlatformAdmin(profile?.data)) {
          if (!pathname.startsWith("/admin/")) { const url=request.nextUrl.clone(); url.pathname=ADMIN_HOME; url.search=""; return NextResponse.redirect(url); }
          return response;
        }
        if (pathname.startsWith("/admin/")) { const url=request.nextUrl.clone(); url.pathname="/dashboard"; url.search=""; return NextResponse.redirect(url); }
        const status = await fetch(`${base}/api/v1/seller-organizations/me`, { headers, cache: "no-store" });
        const body = status.ok ? await status.json() : null;
        const approval = body?.data?.approvalStatus;
        const target = status.status === 404 ? "/seller/onboarding" : approval === "Pending" ? "/seller/pending" : approval === "Rejected" ? "/seller/rejected" : approval === "Suspended" ? "/seller/suspended" : null;
        if (target) { const url=request.nextUrl.clone(); url.pathname=target; url.search=""; return NextResponse.redirect(url); }
      } catch { /* backend failures are handled by the page/API client */ }
    }
  }
  return response;
}
