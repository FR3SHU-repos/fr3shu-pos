import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";
import { serverGoApiBase } from "@/shared/lib/api/server-base";
import { authIntent, destinationForCapabilities } from "@/shared/lib/auth/intent";
import { requestOrigin } from "@/shared/lib/http/request-origin";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard";
  const origin = requestOrigin(request);
  const requestedIntent = url.searchParams.get("as") ?? request.cookies.get("komola_auth_intent")?.value;

  if (errorParam || !code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // The browser client can finish a recovered PKCE exchange before this
    // server callback receives the redirected code. In that case the code is
    // single-use and exchangeCodeForSession fails, while the session itself is
    // already valid. Only reject the login when neither exchange nor session
    // authentication succeeded.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  let destination = next;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const metadataIntent = typeof session?.user.user_metadata?.account_type === "string"
      ? session.user.user_metadata.account_type
      : undefined;
    const intent = authIntent(requestedIntent ?? metadataIntent ?? (next.startsWith("/buyer") ? "buyer" : "seller"));
    const headers = {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
    const apiBase = serverGoApiBase();
    const reconciled = await fetch(`${apiBase}/api/v1/auth/reconcile`, {
      method: "POST",
      headers,
      body: "{}",
      cache: "no-store",
    });
    if (!reconciled.ok) return NextResponse.redirect(`${origin}/login?error=reconcile_failed`);
    const capabilitiesResponse = await fetch(`${apiBase}/api/v1/me/capabilities`, { headers, cache: "no-store" });
    if (!capabilitiesResponse.ok) return NextResponse.redirect(`${origin}/login?error=reconcile_failed`);
    const capabilitiesBody = await capabilitiesResponse.json();
    const capabilities = capabilitiesBody?.data ?? { buyer: false, seller: false };

    // A registered category takes priority over the category selected during
    // login. Only identities with no category enter an onboarding flow.
    destination = destinationForCapabilities(intent, capabilities);
    if (destination === "/buyer/setup") {
      const phone = typeof session?.user.user_metadata?.buyer_phone_e164 === "string" ? session.user.user_metadata.buyer_phone_e164 : "";
      const displayName = typeof session?.user.user_metadata?.display_name === "string" ? session.user.user_metadata.display_name : "Buyer";
      if (phone) {
        const profile = await fetch(`${apiBase}/api/v1/me/profile`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ displayName, buyer: true, phoneE164: phone }),
          cache: "no-store",
        });
        return NextResponse.redirect(`${origin}${profile.ok ? "/buyer" : "/buyer/setup"}`);
      }
      return NextResponse.redirect(`${origin}/buyer/setup`);
    }
    if (destination === "/buyer") return NextResponse.redirect(`${origin}/buyer`);

    const me = await fetch(`${apiBase}/api/v1/pos/auth/me`, { headers, cache: "no-store" });
    if (!me.ok) return NextResponse.redirect(`${origin}/login?error=reconcile_failed`);
    const profile = await me.json();
    if (isPlatformAdmin(profile?.data)) {
      destination = ADMIN_HOME;
    } else if (destination === "/dashboard") {
      const status = await fetch(`${apiBase}/api/v1/seller-organizations/me`, { headers, cache: "no-store" });
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
