import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { Landing } from "@/shared/components/landing/Landing";

// Public landing page. Auth-based redirects for the app itself live in
// `middleware.ts`; `/` is intentionally allowed through so anyone can see this.
export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Landing signedIn={Boolean(user)} />;
}
