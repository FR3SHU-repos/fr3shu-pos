import type { PersonProfile } from "@/shared/lib/api/identity";

export function missingBuyerDetails(profile: PersonProfile | null): string[] {
  if (!profile) return ["your name", "mobile number", "buyer location", "complete address"];
  const missing: string[] = [];
  const phone = profile.contacts.find((contact) => contact.type === "phone");
  const address = profile.address;
  if (!profile.displayName.trim()) missing.push("your name");
  if (!phone) missing.push("mobile number");
  if (!profile.locationCode) missing.push("buyer location");
  if (
    !address?.line1?.trim() ||
    !address.city?.trim() ||
    !address.state?.trim() ||
    !/^\d{6}$/.test(address.postalCode?.trim() ?? "")
  )
    missing.push("complete address");
  return missing;
}

export function buyerProfileReady(profile: PersonProfile | null): boolean {
  return Boolean(profile?.buyer && missingBuyerDetails(profile).length === 0);
}

/**
 * Campaign discovery only needs the buyer identity, contact phone, and the
 * enabled platform location. A complete delivery address is enforced by the
 * API when the buyer claims a home-delivery campaign, not when they browse
 * available offers.
 */
export function buyerCampaignsReady(profile: PersonProfile | null): boolean {
  if (!profile?.buyer || !profile.displayName.trim() || !profile.locationCode) {
    return false;
  }
  return profile.contacts.some((contact) => contact.type === "phone");
}

export function missingBuyerCampaignDetails(profile: PersonProfile | null): string[] {
  if (!profile) return ["your name", "mobile number", "buyer location"];
  const missing: string[] = [];
  const phone = profile.contacts.find((contact) => contact.type === "phone");
  if (!profile.displayName.trim()) missing.push("your name");
  if (!phone) missing.push("mobile number");
  if (!profile.locationCode) missing.push("buyer location");
  return missing;
}
