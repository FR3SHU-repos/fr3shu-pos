"use client";

import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** Browser Supabase client for auth (PKCE, sb-* cookies via @supabase/ssr). */
export function createAuthBrowserClient() {
  return createBrowserClient(URL || "https://placeholder.supabase.co", KEY || "placeholder-anon-key");
}

export const supabaseAuthConfigured = Boolean(URL && KEY);
