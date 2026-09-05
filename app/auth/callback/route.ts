import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard";
  const origin = url.origin;

  if (errorParam || !code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch(`${apiBase()}/api/v1/auth/reconcile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: "{}",
      cache: "no-store",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.redirect(`${origin}${next}`);
}
