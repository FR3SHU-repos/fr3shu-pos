import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

/** Clear the SSR auth cookies used by middleware and server components. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.json(
    { success: !error },
    {
      status: error ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name === "token" ||
      cookie.name === "komola_auth_intent"
    ) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0, expires: new Date(0) });
    }
  }
  // Do not clear browser storage here: the scoped IndexedDB outbox may contain
  // unsynced financial records that must survive logout for explicit recovery.
  // The POS context locks the scope and clears the active session state.
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}
