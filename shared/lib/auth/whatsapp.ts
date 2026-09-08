export function normalizeIndianWhatsApp(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const local = compact.startsWith("+91") ? compact.slice(3) : compact;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return `+91${local}`;
}

export function validOtp(value: string): boolean { return /^\d{6}$/.test(value); }
export function maskedPhone(e164: string): string { return `+91 •••••• ${e164.slice(-4)}`; }
