import type { PersonProfile } from "@/shared/lib/api/identity";

export function missingBuyerDetails(profile: PersonProfile | null): string[] {
  if (!profile) return ["your name", "mobile number", "buyer location", "complete address"];
  const missing: string[] = [];
  const phone = profile.contacts.find((contact) => contact.type === "phone");
  const address = profile.address;
  if (!profile.displayName.trim()) missing.push("your name");
  if (!phone) missing.push("mobile number");
  if (!profile.locationCode) missing.push("buyer location");
  if (!address?.line1?.trim() || !address.city?.trim() || !address.state?.trim() || !/^\d{6}$/.test(address.postalCode?.trim() ?? "")) missing.push("complete address");
  return missing;
}

export function buyerProfileReady(profile: PersonProfile | null): boolean {
  return Boolean(profile?.buyer && missingBuyerDetails(profile).length === 0);
}
