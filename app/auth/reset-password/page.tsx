"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { cardCls, primaryBtnCls } from "@/shared/components/ui";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";
import { ginFetch } from "@/shared/lib/auth/gin";
import {
  PasswordField,
  StrengthMeter,
  passwordScore,
} from "@/shared/components/auth/parts";

function ResetInner() {
  const router = useRouter();
  const supabase = createAuthBrowserClient();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValid(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValid(true);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (passwordScore(password).score < 1) {
      toast.error("Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      toast.error("This reset link is invalid or has expired.");
      return;
    }
    await ginFetch("/account/security/audit", {
      method: "POST",
      body: JSON.stringify({ event: "password_changed" }),
    }).catch(() => {});
    await supabase.auth.signOut();
    toast.success("Password updated. Please sign in.");
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className={`${cardCls} w-full max-w-sm`}>
        <h1 className="text-lg font-semibold text-foreground-heading">
          Set a new password
        </h1>
        {!ready ? (
          <p className="mt-4 text-sm text-foreground-muted">Checking your link…</p>
        ) : !valid ? (
          <div className="mt-4">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              This reset link is invalid or expired.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/auth/forgot-password")}
              className={`${primaryBtnCls} mt-4 w-full`}
            >
              Request a new link
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <PasswordField
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={8}
              />
              <StrengthMeter password={password} />
            </div>
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              minLength={8}
            />
            <button type="submit" disabled={saving} className={`${primaryBtnCls} w-full`}>
              {saving ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
