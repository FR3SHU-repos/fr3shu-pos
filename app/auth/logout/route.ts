import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

/** Clear the SSR auth cookies used by middleware and server components. */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  return NextResponse.json(
    { success: !error },
    {
      status: error ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
