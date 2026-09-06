export function googleAuthEnabled(value = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED): boolean {
  return value === "true";
}

// Deliberately false until verified WhatsApp evidence can be exchanged for a
// supported Supabase session. The public flag alone must never enable it.
export function whatsappAuthEnabled(): boolean { return false; }

export function sellerGoogleRedirect(origin: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("intent", "seller-register");
  return url.toString();
}
