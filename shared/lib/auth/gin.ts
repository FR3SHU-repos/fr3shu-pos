"use client";

import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

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
  return fetch(`/api/v1${path}`, {
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

export function safeNext(next: string | null, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}
