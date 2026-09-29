import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { authIntent } from "@/shared/lib/auth/intent";
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

  // The authenticated API middleware reconciles the Supabase identity on the
  // first protected request. Do not wait for reconciliation, bootstrap, and
  // role queries here: the dashboard loads bootstrap once on the client and
  // can render its shell while those data requests complete.
  const { data: { session } } = await supabase.auth.getSession();
  const metadataIntent = typeof session?.user.user_metadata?.account_type === "string"
    ? session.user.user_metadata.account_type
    : undefined;
  const intent = authIntent(requestedIntent ?? metadataIntent ?? (next.startsWith("/buyer") ? "buyer" : "seller"));
  const destination = intent === "buyer" && next === "/dashboard" ? "/buyer" : next;
  return NextResponse.redirect(`${origin}${destination}`);
}
