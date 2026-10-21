/** Typed HTTP boundary. All browser application data goes through the same-origin
 * /api/v1 proxy to Go. Supabase is used solely to obtain the Auth bearer token. */

export interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T | null;
  status: number;
  /** Machine-readable error code from the Go envelope, when present. */
  code?: string;
  /** Server-provided retry delay from Retry-After, in milliseconds. */
  retryAfterMs?: number;
  /** Response size when the server exposes a Content-Length header. */
  responseBytes?: number;
  /** Safe server correlation id for support diagnostics. */
  requestId?: string;
}

export function apiBase(value: string | undefined): string {
  return (value?.trim() ?? "").replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

/**
 * Browser requests intentionally use the same-origin proxy. This keeps the
 * deployed UI and Go API on one route, forwards the current auth token, and
 * prevents a stale public API environment variable from sending one feature
 * to an older backend deployment.
 */
const GO_BASE = "";

export function apiURL(path: string, base = GO_BASE): string {
  const clean = path.replace(/^\/+/, "");
  return `${apiBase(base)}/api/v1/${clean}`;
}

async function normalize<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  const b = (body ?? {}) as {
    success?: boolean;
    message?: string;
    data?: T;
    error?: string;
    code?: string;
  };
  const contentLength = res.headers?.get?.("Content-Length");
  return {
    success: res.ok && b.success === true,
    message: b.message ?? (res.ok ? "Success" : `Request failed (${res.status})`),
    data: (b.data ?? null) as T | null,
    status: res.status,
    code: b.code,
    retryAfterMs: parseRetryAfter(res.headers?.get?.("Retry-After") ?? null),
    responseBytes: contentLength && Number.isFinite(Number(contentLength)) ? Number(contentLength) : undefined,
    requestId: res.headers?.get?.("X-Request-ID") ?? undefined,
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Sent as the `Idempotency-Key` header on mutations. */
  idempotencyKey?: string;
}

const inFlightGets = new Map<string, Promise<ApiResult<unknown>>>();

/** The current Supabase access token (browser only), for `Authorization: Bearer`. */
async function supabaseBearer(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { createAuthBrowserClient } = await import(
      "@/shared/lib/supabase/auth-client"
    );
    const {
      data: { session },
    } = await createAuthBrowserClient().auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function refreshSupabaseBearer(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { createAuthBrowserClient } = await import(
      "@/shared/lib/supabase/auth-client"
    );
    const {
      data: { session },
    } = await createAuthBrowserClient().auth.refreshSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function requestAt<T>(base: string, path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, query, signal, headers, idempotencyKey } = opts;

  let target = apiURL(path, base);
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) target += `?${s}`;
  }

  const bearer = await supabaseBearer();

  const isCacheableGet = method === "GET" && !signal;
  const cacheKey = isCacheableGet ? `${target}|${bearer ?? "anonymous"}` : "";
  if (cacheKey) {
    const existing = inFlightGets.get(cacheKey);
    if (existing) return existing as Promise<ApiResult<T>>;
  }

  const requestPromise = (async () => { try {
    const requestWithBearer = (token: string | null) => fetch(target, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    let res = await requestWithBearer(bearer);
    if (res.status === 401) {
      const refreshedBearer = await refreshSupabaseBearer();
      if (refreshedBearer && refreshedBearer !== bearer) {
        res = await requestWithBearer(refreshedBearer);
      }
    }
    return normalize<T>(res);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
      data: null,
      status: 0,
    };
  } })();
  if (cacheKey) {
    inFlightGets.set(cacheKey, requestPromise as Promise<ApiResult<unknown>>);
    void requestPromise.then(
      () => inFlightGets.delete(cacheKey),
      () => inFlightGets.delete(cacheKey),
    );
  }
  return requestPromise;
}

/** Call an arbitrary `/api/v1/<path>` operation on the Go backend. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  return requestAt<T>(GO_BASE, path, opts);
}

/** Call a POS operation through the database-free same-origin Go proxy. */
export async function goRequest<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  return requestAt<T>(GO_BASE, `pos/${path.replace(/^\/+/, "")}`, opts);
}

/** Historical alias; catalogue reads share the same backend now. */
export const catalogueRequest = request;
