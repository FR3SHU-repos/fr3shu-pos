/**
 * The single client -> server boundary. Every UI call goes through here.
 *
 * Today `request()` hits this app's own /api/v1 route handlers. To move onto the
 * FR3SH Go/Gin service later, set NEXT_PUBLIC_API_BASE_URL and (if the envelope
 * differs) adapt `normalize()` — no component code changes.
 */

export interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T | null;
  status: number;
}

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function url(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}/api/v1${clean}`;
}

async function normalize<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  const b = (body ?? {}) as { success?: boolean; message?: string; data?: T; error?: string };
  return {
    success: b.success ?? res.ok,
    message: b.message ?? (res.ok ? "Success" : `Request failed (${res.status})`),
    data: (b.data ?? null) as T | null,
    status: res.status,
  };
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, query, signal, headers } = opts;

  let target = url(path);
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) target += `?${s}`;
  }

  try {
    const res = await fetch(target, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    return normalize<T>(res);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
      data: null,
      status: 0,
    };
  }
}
