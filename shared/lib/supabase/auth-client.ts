"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function validSupabaseUrl(value: string): string {
  try {
    const parsed = new globalThis.URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : "";
  } catch {
    return "";
  }
}

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client for auth (PKCE, sb-* cookies via @supabase/ssr). */
export function createAuthBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      validSupabaseUrl(SUPABASE_URL) || "https://placeholder.supabase.co",
      KEY || "placeholder-anon-key",
    );
  }
  return browserClient;
}

export const supabaseAuthConfigured = Boolean(validSupabaseUrl(SUPABASE_URL) && KEY);
