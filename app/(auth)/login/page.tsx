"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Lock } from "lucide-react";

import { usePosUser } from "@/shared/context/PosUserContext";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { bridgeLogin, reconcileIdentity } from "@/shared/lib/auth/gin";
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

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { refresh } = usePosUser();
  const supabase = createAuthBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const normEmail = email.trim().toLowerCase();

    let { error } = await supabase.auth.signInWithPassword({
      email: normEmail,
      password,
    });
    if (error && /invalid login credentials/i.test(error.message)) {
      const { migrated } = await bridgeLogin(normEmail, password);
      if (migrated) {
        ({ error } = await supabase.auth.signInWithPassword({
          email: normEmail,
          password,
        }));
      }
    }
    if (error) {
      setBusy(false);
      toast.error(
        /email not confirmed/i.test(error.message)
          ? "Please verify your email first."
          : "Invalid email or password.",
      );
      return;
    }
    await reconcileIdentity();
    await refresh();
    setBusy(false);
    router.replace(next);
  }

  async function onGoogle() {
    setGoogleBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setGoogleBusy(false);
      toast.error("Google sign-in is unavailable right now.");
    }
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
          <p className="text-sm text-foreground-muted">Sign in to your seller account</p>
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
          <WhatsAppButton />
        </div>

        <p className="mt-5 text-center text-xs text-foreground-muted">
          Need an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Contact your administrator
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
