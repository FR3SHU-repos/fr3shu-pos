"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { identityApi } from "@/shared/lib/api";
import { cardCls, inputCls, primaryBtnCls } from "@/shared/components/ui";

export default function BuyerSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const result = await identityApi.updateProfile(name, true);
    setBusy(false);
    if (!result.success) return setError(result.message);
    router.replace("/buyer");
  }
  return <main className="flex min-h-screen items-center justify-center bg-surface p-4"><form onSubmit={submit} className={`${cardCls} w-full max-w-md space-y-4`}>
    <h1 className="text-2xl font-semibold">Your buyer profile</h1>
    <p className="text-foreground-muted">Use one KOMOLA account for invoices, points, and selling.</p>
    <label className="block font-medium" htmlFor="buyer-name">Your name</label>
    <input id="buyer-name" className={inputCls} value={name} onChange={e=>setName(e.target.value)} required minLength={2} autoComplete="name" />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button className={`${primaryBtnCls} min-h-12 w-full`} disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
  </form></main>;
}
