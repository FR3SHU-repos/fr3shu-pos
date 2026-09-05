"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

const COOLDOWN = 60;

export default function ForgotPasswordPage() {
  const supabase = createAuthBrowserClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setBusy(false);
    setSent(true);
    setCooldown(COOLDOWN);
    toast.success("If that email has an account, a reset link is on its way.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className={`${cardCls} w-full max-w-sm`}>
        <h1 className="text-lg font-semibold text-foreground-heading">
          Reset your password
        </h1>
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground-body">
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={busy || cooldown > 0}
            className={`${primaryBtnCls} w-full`}
          >
            {busy
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Send reset link"}
          </button>
        </form>
        {sent && (
          <p className="mt-3 rounded-lg bg-primary/5 p-3 text-xs text-foreground-body">
            Check your inbox for the reset link.
          </p>
        )}
        <p className="mt-5 text-center text-xs text-foreground-muted">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
