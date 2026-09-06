import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";

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

  let destination = next;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers = {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
    const reconciled = await fetch(`${apiBase()}/api/v1/auth/reconcile`, {
      method: "POST",
      headers,
      body: "{}",
      cache: "no-store",
    });
    if (!reconciled.ok) return NextResponse.redirect(`${origin}/login?error=reconcile_failed`);
    const me = await fetch(`${apiBase()}/api/v1/pos/auth/me`, { headers, cache: "no-store" });
    if (!me.ok) return NextResponse.redirect(`${origin}/login?error=reconcile_failed`);
    const profile = await me.json();
    if (isPlatformAdmin(profile?.data)) {
      destination = ADMIN_HOME;
    } else {
      const status = await fetch(`${apiBase()}/api/v1/seller-organizations/me`, { headers, cache: "no-store" });
      if (status.status === 404) destination = "/seller/onboarding";
      else if (status.ok) {
        const body = await status.json();
        const value = body?.data?.approvalStatus;
        destination = value === "Approved" ? "/dashboard" : value === "Rejected" ? "/seller/rejected" : value === "Suspended" ? "/seller/suspended" : "/seller/pending";
      }
    }
  } catch {
    return NextResponse.redirect(`${origin}/login?error=reconcile_failed`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
