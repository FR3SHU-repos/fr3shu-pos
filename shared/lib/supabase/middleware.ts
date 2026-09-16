import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isBuyerExperiencePath } from "@/shared/lib/auth/intent";
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

  // These routes do not use the middleware's verified user. API requests
  // carry their bearer token to Go, and auth routes manage their own session.
  // Avoid an extra Supabase network round trip before each request.
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/")) {
    return response;
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

  if (!user) {
    const url = redirectTo(request, "/login");
    if (safe(pathname)) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Keep navigation fast and resilient: middleware only verifies the Supabase
  // session. Capability, organization status, and role checks belong to the Go
  // API, which enforces them independently for every protected operation.
  return response;
}
