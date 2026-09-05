/**
 * The single client -> server boundary. Every UI call goes through here.
 *
 * The POS web app no longer has a database of its own: `go-api-backend` owns
 * the entire POS runtime (catalogue reads, inventory, registers, shifts, sales,
 * tenders, voids, returns). `goRequest()` targets that service directly at
 * `/api/v1/pos/*`; the same-origin `/api/v1/*` route handlers are now thin
 * database-free proxies kept only for compatibility.
 */

export interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T | null;
  status: number;
  /** Machine-readable error code from the Go envelope, when present. */
  code?: string;
}

export function apiBase(value: string | undefined): string {
  return (value?.trim() ?? "").replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

/**
 * The Go backend base URL. `NEXT_PUBLIC_API_BASE_URL` is preferred;
 * `NEXT_PUBLIC_CATALOGUE_API_BASE_URL` is accepted as the historical name from
 * the incremental catalogue migration. An empty value means "same origin",
 * which reaches the compatibility proxies.
 */
const GO_BASE = apiBase(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_CATALOGUE_API_BASE_URL,
);

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
  return {
    success: b.success ?? res.ok,
    message: b.message ?? (res.ok ? "Success" : `Request failed (${res.status})`),
    data: (b.data ?? null) as T | null,
    status: res.status,
    code: b.code,
  };
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

  try {
    const res = await fetch(target, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
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

/** Call an arbitrary `/api/v1/<path>` operation on the Go backend. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  return requestAt<T>(GO_BASE, path, opts);
}

/**
 * Call a `/api/v1/pos/<path>` operation on the canonical POS API.
 *
 * Always routed through this app's own same-origin `/api/v1/pos/*` proxy so the
 * httpOnly `pos_token` cookie is sent on every call and a login `Set-Cookie`
 * relays back to the browser. The proxy itself has no database access.
 */
export async function goRequest<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  return requestAt<T>("", `pos/${path.replace(/^\/+/, "")}`, opts);
}

/** Historical alias; catalogue reads share the same backend now. */
export const catalogueRequest = request;
