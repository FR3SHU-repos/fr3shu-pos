"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import type { SellerOrgType } from "@/shared/lib/api/sellerOrgs";
import { Divider, GoogleButton } from "@/shared/components/auth/parts";
import type { AuthIntent } from "@/shared/lib/auth/intent";
import { reconcileIdentity } from "@/shared/lib/auth/gin";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import { authCallbackRedirect, rememberAuthIntent } from "@/shared/lib/auth/providers";
import { KomoMessage } from "@/shared/components/mascot";

function registrationErrorMessage(message: string): string {
  const error = message.toLowerCase();
  if (
    error.includes("already registered") ||
    error.includes("already exists") ||
    error.includes("user already") ||
    (error.includes("phone number") && error.includes("registered"))
  ) {
    return "This mobile number is already registered. Sign in with your mobile number instead.";
  }
  if (
    error.includes("hook") ||
    (error.includes("phone") && (error.includes("disabled") || error.includes("not enabled"))) ||
    (error.includes("sms") &&
      (error.includes("provider") || error.includes("disabled") || error.includes("not enabled")))
  ) {
    return "Phone registration is unavailable because phone authentication is disabled or its SMS service is misconfigured. Enable the Supabase Phone provider or use an email address.";
  }
  if (error.includes("rate limit") || error.includes("too many") || error.includes("60 seconds")) {
    return "Too many registration attempts. Please wait a minute and try again.";
  }
  if (error.includes("invalid phone")) {
    return "Enter a valid mobile number and try again.";
  }
  return "Registration could not be completed. Please check your details and try again.";
}

export function RegisterForm({ intent }: { intent: AuthIntent }) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
    sellerType: "Farmer" as SellerOrgType,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [adultAcknowledged, setAdultAcknowledged] = useState(false);
  async function google() {
    if (googleBusy) return;
    if (!privacyAcknowledged) {
      setError("Please review and acknowledge the privacy notice before continuing.");
      return;
    }
    if (!adultAcknowledged) {
      setError("KOMOLA accounts are currently for users aged 18 and above.");
      return;
    }
    setGoogleBusy(true);
    setError("");
    rememberAuthIntent(intent);
    const redirectTo = authCallbackRedirect(window.location.origin, { intent });
    const { error } = await createAuthBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setGoogleBusy(false);
      setError("Google registration is temporarily unavailable.");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.fullName.trim().length < 2) return setError("Enter your full name.");
    if (!privacyAcknowledged)
      return setError(
        "Please review and acknowledge the privacy notice before creating your account.",
      );
    if (!adultAcknowledged)
      return setError("KOMOLA accounts are currently for users aged 18 and above.");
    const phoneE164 = normalizeIndianMobile(form.phone);
    if (!phoneE164) return setError("Enter a valid 10-digit Indian mobile number.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    rememberAuthIntent(intent);
    const email = form.email.trim().toLowerCase();
    const options = {
      data: {
        display_name: form.fullName.trim(),
        account_type: intent,
        phone_e164: phoneE164,
        adult_account_acknowledged: true,
        ...(intent === "buyer" ? { buyer_phone_e164: phoneE164 } : {}),
      },
    };
    const { data, error } = await createAuthBrowserClient().auth.signUp(
      email
        ? {
            email,
            password: form.password,
            options: { ...options, emailRedirectTo: authCallbackRedirect(window.location.origin) },
          }
        : { phone: phoneE164, password: form.password, options },
    );
    if (error) {
      if (process.env.NODE_ENV !== "production")
        console.warn("KOMOLA registration failed:", error.message);
      setBusy(false);
      return setError(registrationErrorMessage(error.message));
    }
    if (intent === "seller")
      sessionStorage.setItem(
        "komola:seller-draft",
        JSON.stringify({
          fullName: form.fullName.trim(),
          phone: phoneE164,
          sellerType: form.sellerType,
        }),
      );
    if (!data.session && !email) {
      sessionStorage.setItem(
        "komola:pending-phone-signup",
        JSON.stringify({ intent, phone: phoneE164 }),
      );
      setBusy(false);
      router.replace("/auth/check-phone");
      return;
    }
    if (data.session && intent === "buyer") {
      await reconcileIdentity(data.session.access_token);
      setBusy(false);
      router.replace("/buyer/setup");
      return;
    }
    setBusy(false);
    router.replace(data.session ? "/seller/onboarding" : email ? "/auth/check-email" : "/login");
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <form onSubmit={submit} className={`${cardCls} w-full max-w-md space-y-3`}>
        <KomoMessage
          action={intent === "buyer" ? "happy" : "produce"}
          title={
            intent === "buyer"
              ? "Let’s make your purchases count."
              : "Let’s get your business ready."
          }
          description={
            intent === "buyer"
              ? "Komo will help keep your rewards and receipts together."
              : "Komo will guide you through setting up your KOMOLA POS."
          }
          compact
        />
        <div>
          <h1 className="text-xl font-semibold capitalize">Create your {intent} account</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Register for the {intent === "buyer" ? "rewards and receipts" : "point-of-sale"} portal.
          </p>
          <Link
            href="/register"
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Choose a different account type
          </Link>
        </div>
        <label className="flex items-start gap-3 rounded-lg bg-surface p-3 text-xs leading-5 text-foreground-muted">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={privacyAcknowledged}
            onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
          />
          <span>
            I have read the{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-primary underline">
              KOMOLA privacy notice
            </Link>{" "}
            and understand the account, security, receipt and rewards processing needed for this
            portal. <span className="text-primary">*</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg bg-surface p-3 text-xs leading-5 text-foreground-muted">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={adultAcknowledged}
            onChange={(event) => setAdultAcknowledged(event.target.checked)}
          />
          <span>
            I confirm that I am 18 years of age or older. KOMOLA currently does not offer child
            accounts. <span className="text-primary">*</span>
          </span>
        </label>
        <GoogleButton onClick={google} loading={googleBusy} />
        <Divider />
        <input
          aria-label="Full name"
          className={inputCls}
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <div>
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="register-phone">
            Mobile number <span className="text-primary">*</span>
          </label>
          <input
            id="register-phone"
            className={inputCls}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
            }
            required
          />
          <p className="mt-1.5 text-xs text-foreground-muted">
            Required for contacting you. Use this number with your password to sign in.
          </p>
        </div>
        <input
          aria-label="Email (optional)"
          className={inputCls}
          type="email"
          placeholder="Email (optional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          aria-label="Password"
          className={inputCls}
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <input
          aria-label="Confirm password"
          className={inputCls}
          type="password"
          placeholder="Confirm password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          required
        />
        {intent === "seller" && (
          <select
            aria-label="Seller type"
            className={inputCls}
            value={form.sellerType}
            onChange={(e) => setForm({ ...form, sellerType: e.target.value as SellerOrgType })}
          >
            {["Farmer", "FPO", "Retailer", "Brand"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        {error && (
          <p role="alert" aria-live="polite" className="text-sm text-status-danger">
            {error}
          </p>
        )}
        <button disabled={busy} className={`${primaryBtnCls} w-full`}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm">
          <Link href={`/login/${intent}`} className="text-primary">
            Already registered? Sign in as a {intent}
          </Link>
        </p>
      </form>
    </main>
  );
}
