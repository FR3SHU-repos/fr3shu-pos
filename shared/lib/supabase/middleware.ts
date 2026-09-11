import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";
import { isBuyerExperiencePath } from "@/shared/lib/auth/intent";
import { serverGoApiBase } from "@/shared/lib/api/server-base";
import { requestOrigin } from "@/shared/lib/http/request-origin";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const PUBLIC_PREFIXES = ["/login", "/register", "/auth/"];

function safe(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

function redirectTo(request: NextRequest, pathname: string): URL {
  return new globalThis.URL(pathname, requestOrigin(request));
}

function isAuthLandingPath(pathname: string): boolean {
  return pathname === "/buyer/setup" || pathname === "/seller/onboarding" || pathname === "/dashboard";
}

/** Refresh the Supabase session; gate everything except the public auth pages. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!URL || !KEY) return response;

  // Some Supabase confirmation/OAuth links can fall back to their requested
  // destination while still carrying the PKCE code. Always exchange that code
  // in the callback before a protected page or API attempts to use the session.
  const { pathname, searchParams } = request.nextUrl;
  const authCode = searchParams.get("code");
  if (isAuthLandingPath(pathname) && authCode && /^[0-9a-f-]{36}$/i.test(authCode)) {
    const callback = redirectTo(request, "/auth/callback");
    callback.searchParams.set("code", authCode);
    callback.searchParams.set("next", safe(pathname) ? pathname : "/dashboard");
    if (isBuyerExperiencePath(pathname)) callback.searchParams.set("as", "buyer");
    return NextResponse.redirect(callback);
  }

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

  if (pathname === "/") return response; // public landing page
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return response;
  if (pathname.startsWith("/api/")) return response; // proxy relays its own auth

  if (!user) {
    const url = redirectTo(request, "/login");
    if (safe(pathname)) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Buyer reward pages require the exclusive buyer capability. Seller
  // membership takes precedence and routes the identity to its POS dashboard.
  if (isBuyerExperiencePath(pathname)) {
    const { data: { session } } = await supabase.auth.getSession();
    const base = serverGoApiBase();
    if (base && session?.access_token) {
      try {
        const capabilities = await fetch(`${base}/api/v1/me/capabilities`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (capabilities.ok) {
          const body = await capabilities.json();
          if (body?.data?.seller || (pathname !== "/buyer/setup" && !body?.data?.buyer)) {
            const url = redirectTo(request, body?.data?.seller ? "/dashboard" : "/buyer/setup");
            return NextResponse.redirect(url);
          }
        }
      } catch { /* page API requests show backend availability errors */ }
    }
    return response;
  }

  // UX gate only; Go independently enforces administrative restrictions.
  if (!pathname.startsWith("/seller/") && pathname !== "/") {
    const { data: { session } } = await supabase.auth.getSession();
    const base = serverGoApiBase();
    if (base && session?.access_token) {
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const me = await fetch(`${base}/api/v1/pos/auth/me`, { headers, cache: "no-store" });
        if (!me.ok) return response;
        const profile = await me.json();
        if (isPlatformAdmin(profile?.data)) {
          if (!pathname.startsWith("/admin/")) { return NextResponse.redirect(redirectTo(request, ADMIN_HOME)); }
          return response;
        }
        if (pathname.startsWith("/admin/")) { return NextResponse.redirect(redirectTo(request, "/dashboard")); }
        const status = await fetch(`${base}/api/v1/seller-organizations/me`, { headers, cache: "no-store" });
        const body = status.ok ? await status.json() : null;
        const approval = body?.data?.approvalStatus;
        const target = status.status === 404 ? "/seller/onboarding" : approval === "Pending" ? "/seller/pending" : approval === "Rejected" ? "/seller/rejected" : approval === "Suspended" ? "/seller/suspended" : null;
        if (target) { return NextResponse.redirect(redirectTo(request, target)); }
      } catch { /* backend failures are handled by the page/API client */ }
    }
  }
  return response;
}
