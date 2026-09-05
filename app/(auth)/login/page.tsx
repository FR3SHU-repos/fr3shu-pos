"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Lock } from "lucide-react";
import { authApi } from "@/shared/lib/api";
import { usePosUser } from "@/shared/context/PosUserContext";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = usePosUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await authApi.login(email.trim(), password);
    setBusy(false);
    if (!res.success || !res.data) {
      toast.error(res.message || "Login failed");
      return;
    }
    setUser(res.data);
    toast.success(`Welcome, ${res.data.name}`);
    router.replace(params.get("next") || "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className={`${cardCls} w-full max-w-sm`}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-foreground-heading">
            FR3SHU Organic POS
          </h1>
          <p className="text-sm text-foreground-muted">Sign in to your seller account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-foreground-body">
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
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium text-foreground-body"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-foreground-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register
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
