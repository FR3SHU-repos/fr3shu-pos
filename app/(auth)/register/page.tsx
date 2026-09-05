"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, UserPlus } from "lucide-react";
import { authApi } from "@/shared/lib/api";
import type { RegOption } from "@/shared/lib/api/auth";
import { usePosUser } from "@/shared/context/PosUserContext";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = usePosUser();

  const [options, setOptions] = useState<RegOption[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    type: "",
    orgName: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // The account types come from go-api-backend — the same shared set every
  // FR3SH app uses, filtered to those a POS user can pick.
  useEffect(() => {
    authApi.registrationOptions().then((res) => {
      if (res.success && res.data) {
        setOptions(res.data.options);
        setForm((f) => ({ ...f, type: f.type || res.data!.options[0]?.type || "" }));
      } else {
        toast.error(res.message || "Could not load registration options");
      }
    });
  }, []);

  const selected = options.find((o) => o.type === form.type);
  const needsOrgName = selected?.needs?.includes("orgName") ?? false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await authApi.register({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      type: form.type,
      orgName: needsOrgName ? form.orgName.trim() : undefined,
    });
    setBusy(false);

    if (!res.success) {
      toast.error(res.message || "Registration failed");
      return;
    }
    if (res.data?.pendingApproval) {
      setDone(
        res.message ||
          "Your account was created and is awaiting admin approval."
      );
      return;
    }
    // Customer types (Buyer / Farmer / FPO) are active immediately.
    const meRes = await authApi.me();
    if (meRes.success && meRes.data) setUser(meRes.data);
    toast.success("Account created");
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className={`${cardCls} w-full max-w-sm`}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <UserPlus className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-foreground-heading">
            FR3SHU Organic POS
          </h1>
          <p className="text-sm text-foreground-muted">Create your account</p>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground-muted">{done}</p>
            <Link href="/login" className={`${primaryBtnCls} w-full`}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                Full name
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                Email
              </label>
              <input
                type="email"
                autoComplete="username"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                I am a
              </label>
              <select
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputCls}
              >
                <option value="" disabled>
                  Select an account type
                </option>
                {options.map((o) => (
                  <option key={o.type} value={o.type}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {needsOrgName && (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-body">
                  Store / organisation name
                </label>
                <input
                  required
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-body">
                Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputCls}
              />
            </div>
            {selected?.requiresApproval && (
              <p className="text-xs text-foreground-muted">
                Staff accounts are activated by an administrator after review.
              </p>
            )}
            <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create account
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
