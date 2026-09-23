"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client for auth (PKCE, sb-* cookies via @supabase/ssr). */
export function createAuthBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      URL || "https://placeholder.supabase.co",
      KEY || "placeholder-anon-key",
    );
  }
  return browserClient;
}

export const supabaseAuthConfigured = Boolean(URL && KEY);
