export type AuthIntent = "buyer" | "seller";

export function authIntent(value: string | null | undefined): AuthIntent {
  return value === "buyer" ? "buyer" : "seller";
}

export function destinationForCapabilities(
  intent: AuthIntent,
  capabilities: { buyer: boolean; seller: boolean },
): string {
  // Existing account category always wins over the choice made on the login
  // screen. The choice is used only to onboard a brand-new identity.
  if (capabilities.seller) return "/dashboard";
  if (capabilities.buyer) return "/buyer";
  return intent === "buyer" ? "/buyer/setup" : "/seller/onboarding";
}

export function isBuyerExperiencePath(pathname: string): boolean {
  return pathname === "/buyer" || pathname.startsWith("/buyer/");
}
