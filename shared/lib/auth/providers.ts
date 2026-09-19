export function googleAuthEnabled(value = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED): boolean {
  return value === "true";
}

export function authCallbackRedirect(
  origin: string,
  options?: { intent?: "buyer" | "seller"; next?: string },
): string {
  const url = new URL("/auth/callback", origin);
  if (options?.intent) url.searchParams.set("as", options.intent);
  if (options?.next && options.next.startsWith("/") && !options.next.startsWith("//")) {
    url.searchParams.set("next", options.next);
  }
  return url.toString();
}

export function rememberAuthIntent(intent: "buyer" | "seller"): void {
  document.cookie = `komola_auth_intent=${intent}; Path=/; Max-Age=600; SameSite=Lax`;
}

export function sellerGoogleRedirect(origin: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("intent", "seller-register");
  return url.toString();
}
