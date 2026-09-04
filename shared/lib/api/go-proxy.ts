import { NextRequest, NextResponse } from "next/server";

function goApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_CATALOGUE_API_BASE_URL?.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
  return base || null;
}

/** Temporary compatibility path for POS routes cut over to go-api-backend. */
export async function proxyGoGET(request: NextRequest, path: string): Promise<NextResponse> {
  const base = goApiBase();
  if (!base) return NextResponse.json({ success: false, message: "API service is not configured" }, { status: 503 });
  const target = new URL(`${base}/api/v1${path}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const cookie = request.headers.get("cookie");
    const authorization = request.headers.get("authorization");
    if (cookie) headers.Cookie = cookie;
    if (authorization) headers.Authorization = authorization;
    const upstream = await fetch(target, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "API service is unavailable" }, { status: 503 });
  }
}

export async function proxyGoMutation(request: NextRequest, path: string): Promise<NextResponse> {
  const base = goApiBase();
  if (!base) return NextResponse.json({ success: false, message: "API service is not configured" }, { status: 503 });
  const target = `${base}/api/v1${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  };
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  if (cookie) headers.Cookie = cookie;
  if (authorization) headers.Authorization = authorization;
  try {
    const upstream = await fetch(target, { method: request.method, headers, body: await request.text(), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) response.headers.set("Set-Cookie", setCookie);
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "API service is unavailable" }, { status: 503 });
  }
}
