import { NextRequest, NextResponse } from "next/server";

function goApiBase(): string | null {
  const raw =
    process.env.GO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CATALOGUE_API_BASE_URL;
  const base = raw?.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
  return base || null;
}

function notConfigured(): NextResponse {
  return NextResponse.json(
    { success: false, message: "API service is not configured", code: "api_base_unset" },
    { status: 503 },
  );
}

/**
 * Relay an upstream response. If the backend returns a non-JSON body (a bare
 * `404 page not found`, an HTML 502, a platform proxy error), wrap it in the
 * standard envelope so the client's `await res.json()` doesn't throw and surface
 * everything as a generic "Network error".
 */
async function relay(upstream: Response): Promise<NextResponse> {
  const body = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "";
  const setCookie = upstream.headers.get("set-cookie");
  if (contentType.includes("application/json")) {
    const res = new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
    if (setCookie) res.headers.set("Set-Cookie", setCookie);
    return res;
  }
  const message =
    upstream.status === 404
      ? "This endpoint is not available on the backend (it may be an outdated deployment)"
      : `Backend returned ${upstream.status}`;
  return NextResponse.json(
    { success: false, message, code: "upstream_non_json" },
    { status: upstream.status >= 400 ? upstream.status : 502 },
  );
}

function relayHeaders(request: NextRequest, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  const idempotencyKey = request.headers.get("idempotency-key");
  const ifMatch = request.headers.get("if-match");
  if (cookie) headers.Cookie = cookie;
  if (authorization) headers.Authorization = authorization;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (ifMatch) headers["If-Match"] = ifMatch;
  return headers;
}

/** Same-origin, database-free proxy to the canonical POS API in go-api-backend. */
export async function proxyGoGET(request: NextRequest, path: string): Promise<NextResponse> {
  const base = goApiBase();
  if (!base) return notConfigured();
  const target = new URL(`${base}/api/v1${path}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  try {
    const upstream = await fetch(target, {
      headers: relayHeaders(request),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    return relay(upstream);
  } catch {
    return NextResponse.json(
      { success: false, message: "API service is unavailable", code: "upstream_unreachable" },
      { status: 503 },
    );
  }
}

export async function proxyGoMutation(request: NextRequest, path: string): Promise<NextResponse> {
  const base = goApiBase();
  if (!base) return notConfigured();
  const target = `${base}/api/v1${path}`;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: relayHeaders(request, {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
      }),
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    return relay(upstream);
  } catch {
    return NextResponse.json(
      { success: false, message: "API service is unavailable", code: "upstream_unreachable" },
      { status: 503 },
    );
  }
}
