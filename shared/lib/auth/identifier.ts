import { normalizeIndianMobile } from "@/shared/lib/auth/phone";

export type AuthIdentifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

/** Normalize the login identifier without exposing whether an account exists. */
export function normalizeAuthIdentifier(value: string): AuthIdentifier {
  const trimmed = value.trim();
  const phone = normalizeIndianMobile(trimmed);
  return phone
    ? { kind: "phone", value: phone }
    : { kind: "email", value: trimmed.toLowerCase() };
}
