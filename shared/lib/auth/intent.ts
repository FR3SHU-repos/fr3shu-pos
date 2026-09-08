export type AuthIntent = "buyer" | "seller";

export function authIntent(value: string | null | undefined): AuthIntent {
  return value === "buyer" ? "buyer" : "seller";
}

export function destinationForCapabilities(
  intent: AuthIntent,
  capabilities: { buyer: boolean; seller: boolean },
): string {
  if (intent === "buyer") return capabilities.buyer ? "/buyer" : "/buyer/setup";
  return capabilities.seller ? "/dashboard" : "/seller/onboarding";
}

export function isBuyerExperiencePath(pathname: string): boolean {
  return pathname === "/buyer" || pathname.startsWith("/buyer/");
}
