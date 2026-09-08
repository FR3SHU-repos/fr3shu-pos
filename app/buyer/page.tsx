"use client";

import { useEffect, useState } from "react";
import { identityApi } from "@/shared/lib/api";
import type { DiscoveryCode, PersonProfile } from "@/shared/lib/api/identity";
import { cardCls } from "@/shared/components/ui";
import { Copy, Gift, ReceiptText, Share2 } from "lucide-react";

export default function BuyerDashboardPage() {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [code, setCode] = useState<DiscoveryCode | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([identityApi.profile(), identityApi.discoveryCode()]).then(([person, discovery]) => {
    if (person.success) setProfile(person.data); else setError(person.message);
    if (discovery.success) setCode(discovery.data);
  }); }, []);
  async function shareCode() {
    if (!code) return;
    if (navigator.share) await navigator.share({ title: "My KOMOLA buyer code", text: `Use my buyer code ${code.code}`, url: code.url });
    else await navigator.clipboard.writeText(code.url);
  }
  return <main className="mx-auto min-h-screen max-w-3xl bg-surface p-4 sm:p-8">
    <header className="mb-6"><p className="font-semibold text-primary">KOMOLA Buyer</p><h1 className="text-3xl font-bold">{profile?.displayName ? `Hello, ${profile.displayName}` : "Your purchases"}</h1></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Reward points">
      <div className={cardCls}><p className="text-foreground-muted">Available points</p><p className="mt-2 text-4xl font-bold">0</p></div>
      <div className={cardCls}><p className="text-foreground-muted">Pending points</p><p className="mt-2 text-4xl font-bold">0</p></div>
    </section>
    <section className={`${cardCls} mt-4 text-center`} aria-labelledby="buyer-code-title"><h2 id="buyer-code-title" className="text-xl font-semibold">My buyer code</h2><p className="mt-1 text-foreground-muted">Show or share this code with a seller to find your KOMOLA profile.</p><p className="my-5 font-mono text-3xl font-bold tracking-widest">{code?.code ?? "Loading…"}</p><div className="grid grid-cols-2 gap-3"><button type="button" disabled={!code} onClick={()=>code && navigator.clipboard.writeText(code.code)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border font-semibold"><Copy className="h-5 w-5"/>Copy code</button><button type="button" disabled={!code} onClick={shareCode} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"><Share2 className="h-5 w-5"/>Share</button></div></section>
    <section className="mt-4 grid gap-4 sm:grid-cols-2"><div className={cardCls}><ReceiptText className="h-7 w-7 text-primary"/><h2 className="mt-3 text-xl font-semibold">Receipts</h2><p className="mt-2 text-foreground-muted">Your claimed receipts will appear here.</p></div><div className={cardCls}><Gift className="h-7 w-7 text-primary"/><h2 className="mt-3 text-xl font-semibold">Rewards</h2><p className="mt-2 text-foreground-muted">Your point history and prizes will appear here.</p></div></section>
  </main>;
}
