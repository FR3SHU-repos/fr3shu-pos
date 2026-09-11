"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Lock } from "lucide-react";

import { usePosUser } from "@/shared/context/PosUserContext";
import { authApi, identityApi } from "@/shared/lib/api";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { reconcileIdentity } from "@/shared/lib/auth/gin";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";
import { getMyOrganization, sellerDestination } from "@/shared/lib/api/sellerOrgs";
import { destinationForCapabilities, type AuthIntent } from "@/shared/lib/auth/intent";
import {
  Divider,
  GoogleButton,
  PasswordField,
  WhatsAppButton,
} from "@/shared/components/auth/parts";

function safeNext(n: string | null): string {
  return n && n.startsWith("/") && !n.startsWith("//") && !n.includes("://")
    ? n
    : "/dashboard";
}

export function LoginForm({ intent }: { intent: AuthIntent }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { setUser } = usePosUser();
  const supabase = createAuthBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function destination(accessToken?: string): Promise<string> {
    const result = await identityApi.capabilities(accessToken);
    if (result.success && result.data) return destinationForCapabilities(intent, result.data);
    return intent === "buyer" ? "/buyer/setup" : next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const normEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normEmail,
      password,
    });
    if (error) {
      setBusy(false);
      toast.error(
        /email not confirmed/i.test(error.message)
          ? "Please verify your email first."
          : "Invalid email or password.",
      );
      return;
    }
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setBusy(false);
      toast.error("Unable to start your secure session.");
      return;
    }
    const reconciled = await reconcileIdentity(accessToken);
    if (!reconciled) {
      setBusy(false);
      toast.error("Unable to verify your account with the POS service.");
      return;
    }
    // Resolve platform authorization before applying seller-org routing. An
    // Admin intentionally has no seller organization.
    const profile = await authApi.me(accessToken);
    if (!profile.success || !profile.data) {
      setBusy(false);
      toast.error("Unable to load your account permissions.");
      return;
    }
    setUser(profile.data);
    if (isPlatformAdmin(profile.data)) {
      setBusy(false);
      router.replace(ADMIN_HOME);
      return;
    }
    const target = await destination(accessToken);
    if (target === "/buyer" || target === "/buyer/setup") {
      setBusy(false);
      router.replace(target);
      return;
    }
    if (target === "/seller/onboarding") {
      setBusy(false);
      router.replace(target);
      return;
    }
    const org = await getMyOrganization(accessToken);
    setBusy(false);
    router.replace(org.status === 404 ? "/seller/onboarding" : sellerDestination(org.data?.approvalStatus) || next);
  }

  async function onGoogle() {
    setGoogleBusy(true);
    const target = intent === "buyer" ? "/buyer" : next;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}&as=${intent}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setGoogleBusy(false);
      toast.error("Google sign-in is unavailable right now.");
    }
  }
  async function onWhatsAppVerified() {
    await reconcileIdentity();
    const target = await destination();
    if (target === "/buyer" || target === "/buyer/setup" || target === "/seller/onboarding") {
      router.replace(target);
      return;
    }
    const org = await getMyOrganization();
    router.replace(org.status === 404 ? "/seller/onboarding" : sellerDestination(org.data?.approvalStatus) || next);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className={`${cardCls} w-full max-w-sm`}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-foreground-heading">
            KOMOLA Organic POS
          </h1>
          <p className="text-sm text-foreground-muted">One account for buying and selling</p>
        </div>

        <div className="mb-5 rounded-xl bg-surface px-4 py-3 text-center">
          <p className="font-semibold capitalize text-foreground-heading">{intent} login</p>
          <Link href="/login" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">Choose a different portal</Link>
        </div>

        {params.get("error") === "oauth_denied" && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Google sign-in was cancelled.
          </p>
        )}

        <div className="space-y-3">
          <GoogleButton onClick={onGoogle} loading={googleBusy} />
          <Divider />
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-medium text-foreground-body"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <PasswordField label="Password" value={password} onChange={setPassword} />
            <button
              type="submit"
              disabled={busy}
              className={`${primaryBtnCls} w-full`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </button>
          </form>
          <Link
            href="/auth/forgot-password"
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
          <WhatsAppButton onVerified={onWhatsAppVerified} />
        </div>

        <p className="mt-5 text-center text-xs text-foreground-muted">
          Need an account?{" "}
          <Link href={`/register/${intent}`} className="font-medium text-primary hover:underline">
            Register as a {intent}
          </Link>
        </p>
      </div>
    </div>
  );
}
