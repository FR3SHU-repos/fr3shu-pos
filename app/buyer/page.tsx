"use client";

import { useEffect, useState } from "react";
import { identityApi, rewardsApi } from "@/shared/lib/api";
import type { DiscoveryCode, PersonProfile } from "@/shared/lib/api/identity";
import type { RewardLedgerEntry, RewardSummary } from "@/shared/lib/api/rewards";
import { cardCls, EmptyState, Skeleton } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import { Coins, Copy, ReceiptText, Share2 } from "lucide-react";

export default function BuyerDashboardPage() {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [code, setCode] = useState<DiscoveryCode | null>(null);
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([identityApi.profile(), identityApi.discoveryCode(), rewardsApi.summary(), rewardsApi.ledger(undefined, 8)]).then(([person, discovery, rewards, history]) => {
      if (person.success) setProfile(person.data); else setError(person.message);
      if (discovery.success) setCode(discovery.data);
      if (rewards.success) setSummary(rewards.data); else setError(rewards.message);
      if (history.success) setEntries(history.data?.items ?? []);
      setLoading(false);
    });
  }, []);

  async function shareCode() {
    if (!code) return;
    if (navigator.share) await navigator.share({ title: "My KOMOLA buyer code", text: `Use my buyer code ${code.code}`, url: code.url });
    else await navigator.clipboard.writeText(code.url);
  }

  if (loading) return <main className="mx-auto min-h-screen max-w-4xl space-y-4 bg-surface p-4 sm:p-8"><Skeleton className="h-12 w-72"/><Skeleton className="h-40 w-full"/><Skeleton className="h-72 w-full"/></main>;

  return <main className="mx-auto min-h-screen max-w-4xl bg-surface p-4 sm:p-8">
    <header className="mb-6"><p className="font-semibold text-primary">KOMOLA Buyer</p><h1 className="text-3xl font-bold">{profile?.displayName ? `Hello, ${profile.displayName}` : "Your rewards"}</h1><p className="mt-1 text-foreground-muted">Premium rewards and status from verified farm-produce purchases.</p></header>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Komola Coin summary">
      <div className={`${cardCls} sm:col-span-2`}><div className="flex items-center gap-2 text-primary"><Coins className="h-6 w-6"/><p className="font-semibold">Available Komola Coins</p></div><p className="mt-3 text-5xl font-bold text-foreground-heading">{summary?.availableCoins.toLocaleString("en-IN") ?? 0}</p><p className="mt-2 text-sm text-foreground-muted">{summary?.eligibleRemainderMinor ? `${formatPaise(summary.eligibleRemainderMinor)} carried toward your next coin` : "Every ₹100 of verified spending earns 1 coin"}</p></div>
      <div className={cardCls}><p className="text-foreground-muted">Pending coins</p><p className="mt-2 text-4xl font-bold">{summary?.pendingCoins.toLocaleString("en-IN") ?? 0}</p><p className="mt-3 text-sm text-foreground-muted">Finalized after server verification</p></div>
    </section>
    <section className="mt-4 grid gap-4 sm:grid-cols-3" aria-label="Verified purchase totals">
      <div className={cardCls}><p className="text-sm text-foreground-muted">Verified spend</p><p className="mt-2 text-2xl font-bold">{formatPaise(summary?.eligibleSpendMinor ?? 0)}</p></div>
      <div className={cardCls}><p className="text-sm text-foreground-muted">Verified purchases</p><p className="mt-2 text-2xl font-bold">{summary?.verifiedPurchaseCount ?? 0}</p></div>
      <div className={cardCls}><p className="text-sm text-foreground-muted">Lifetime earned</p><p className="mt-2 text-2xl font-bold">{summary?.lifetimeEarnedCoins ?? 0} coins</p></div>
    </section>
    <section className={`${cardCls} mt-4`} aria-labelledby="reward-history-title"><div className="mb-4 flex items-center gap-2"><ReceiptText className="h-6 w-6 text-primary"/><h2 id="reward-history-title" className="text-xl font-semibold">Reward history</h2></div>{entries.length===0?<EmptyState title="No verified rewards yet" description="Your Komola Coins will appear after a seller completes a verified purchase linked to your phone."/>:<ul className="divide-y divide-border">{entries.map(entry=><li key={entry.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium text-foreground-heading">{entry.reason}</p><p className="mt-1 text-xs text-foreground-muted">{new Date(entry.effectiveAt).toLocaleString("en-IN")} · {formatPaise(Math.abs(entry.eligibleAmountMinor))}</p></div><p className={`text-lg font-bold ${entry.coinAmount>=0?"text-status-success":"text-status-danger"}`}>{entry.coinAmount>=0?"+":""}{entry.coinAmount}</p></li>)}</ul>}</section>
    <section className={`${cardCls} mt-4 text-center`} aria-labelledby="buyer-code-title"><h2 id="buyer-code-title" className="text-xl font-semibold">My buyer code</h2><p className="mt-1 text-foreground-muted">Show this code to a KOMOLA seller so verified purchases reach your reward account.</p><p className="my-5 font-mono text-3xl font-bold tracking-widest">{code?.code ?? "Unavailable"}</p><div className="grid grid-cols-2 gap-3"><button type="button" disabled={!code} onClick={()=>code&&navigator.clipboard.writeText(code.code)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border font-semibold disabled:opacity-50"><Copy className="h-5 w-5"/>Copy code</button><button type="button" disabled={!code} onClick={shareCode} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"><Share2 className="h-5 w-5"/>Share</button></div></section>
  </main>;
}
