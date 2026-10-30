"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { reconcileIdentity } from "@/shared/lib/auth/gin";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import type { AuthIntent } from "@/shared/lib/auth/intent";

type PendingPhoneSignup = { intent: AuthIntent; phone: string };

function readPendingSignup(): PendingPhoneSignup | null {
  try {
    const value = JSON.parse(sessionStorage.getItem("komola:pending-phone-signup") ?? "null") as Partial<PendingPhoneSignup> | null;
    return value?.intent && value.phone ? { intent: value.intent, phone: value.phone } : null;
  } catch {
    return null;
  }
}

export default function CheckPhonePage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingPhoneSignup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => setPending(readPendingSignup()), []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!pending || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code sent to your mobile number.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: verifyError } = await createAuthBrowserClient().auth.verifyOtp({ phone: pending.phone, token: code, type: "sms" });
    if (verifyError || !data.session) {
      setBusy(false);
      setError(verifyError?.message?.toLowerCase().includes("expired") ? "That code has expired. Request a new one." : "The code is not valid. Check it and try again.");
      return;
    }
    const reconciled = await reconcileIdentity(data.session.access_token);
    if (!reconciled) {
      setBusy(false);
      setError("Your number was verified, but KOMOLA could not finish setting up the account. Please try signing in again.");
      return;
    }
    sessionStorage.removeItem("komola:pending-phone-signup");
    setBusy(false);
    router.replace(pending.intent === "buyer" ? "/buyer/setup" : "/seller/onboarding");
  }

  async function resend() {
    if (!pending || resending) return;
    setResending(true);
    setError("");
    setMessage("");
    const { error: resendError } = await createAuthBrowserClient().auth.resend({ type: "sms", phone: pending.phone });
    setResending(false);
    if (resendError) {
      setError("We could not send another code yet. Please wait a minute and try again.");
      return;
    }
    setMessage("A new verification code was sent.");
  }

  if (!pending) {
    return <main className="grid min-h-screen place-items-center bg-surface p-4"><section className={`${cardCls} w-full max-w-md text-center`}><h1 className="text-xl font-semibold">Phone verification unavailable</h1><p className="mt-3 text-sm text-foreground-muted">Start registration again to request a new verification code.</p><Link className="mt-5 inline-block text-primary" href="/register">Return to registration</Link></section></main>;
  }

  return <main className="grid min-h-screen place-items-center bg-surface p-4"><form onSubmit={verify} className={`${cardCls} w-full max-w-md space-y-4`}><div><h1 className="text-xl font-semibold">Verify your mobile number</h1><p className="mt-2 text-sm text-foreground-muted">Enter the 6-digit code sent to {pending.phone}. Verification is required before continuing to your {pending.intent} account.</p></div><input aria-label="Verification code" className={inputCls} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />{error && <p role="alert" className="text-sm text-status-danger">{error}</p>}{message && <p className="text-sm text-status-success">{message}</p>}<button disabled={busy} className={`${primaryBtnCls} w-full`}>{busy ? "Verifying…" : "Verify and continue"}</button><button type="button" disabled={resending} onClick={resend} className="w-full text-sm font-semibold text-primary disabled:opacity-60">{resending ? "Sending…" : "Send a new code"}</button><Link href="/login" className="block text-center text-sm text-foreground-muted">Return to sign in</Link></form></main>;
}
