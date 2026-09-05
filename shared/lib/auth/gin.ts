"use client";

import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

function apiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.GO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CATALOGUE_API_BASE_URL ??
    "";
  return raw.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

/** Call the Gin API directly with the Supabase access token as a Bearer. */
export async function ginFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = createAuthBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(`${apiBase()}/api/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function reconcileIdentity(): Promise<{ onboardingComplete: boolean } | null> {
  try {
    const res = await ginFetch("/auth/reconcile", { method: "POST", body: "{}" });
    if (!res.ok) return null;
    const json = await res.json();
    return { onboardingComplete: Boolean(json?.data?.onboardingComplete) };
  } catch {
    return null;
  }
}

export async function bridgeLogin(
  email: string,
  password: string,
): Promise<{ migrated: boolean }> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/auth/bridge/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { migrated: false };
    const json = await res.json();
    return { migrated: Boolean(json?.data?.migrated ?? json?.migrated) };
  } catch {
    return { migrated: false };
  }
}

export function safeNext(next: string | null, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}
