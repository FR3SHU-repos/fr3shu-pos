"use client";

import { request } from "@/shared/lib/api/client";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

/** Call the Gin API directly with the Supabase access token as a Bearer. */
export async function ginFetch(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Response> {
  let token = accessToken;
  if (!token) {
    const supabase = createAuthBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  }

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`/api/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function reconcileIdentity(accessToken?: string): Promise<{ onboardingComplete: boolean; error?: string; status?: number } | null> {
  const res = await request<{ onboardingComplete: boolean }>("auth/reconcile", {
    method: "POST",
    body: {},
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.success) {
    return { onboardingComplete: false, error: res.message, status: res.status };
  }
  return { onboardingComplete: Boolean(res.data?.onboardingComplete) };
}

export function safeNext(next: string | null, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}
