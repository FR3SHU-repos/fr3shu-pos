"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Gift, MapPin, Timer } from "lucide-react";
import { campaignsApi } from "@/shared/lib/api";
import type { BuyerCampaign, BuyerCampaignClaim } from "@/shared/lib/api/campaigns";
import { cardCls, Skeleton } from "@/shared/components/ui";

export default function BuyerCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<BuyerCampaign | null>(null);
  const [claim, setClaim] = useState<BuyerCampaignClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    void campaignsApi.get(params.id).then((result) => {
      if (result.success && result.data) setCampaign(result.data);
      else setError(result.message || "Could not load this campaign.");
      setLoading(false);
    });
  }, [params.id]);

  async function applyForOffer() {
    if (!campaign || busy) return;
    setBusy(true);
    setError("");
    const result = await campaignsApi.claim(campaign.id);
    setBusy(false);
    if (!result.success || !result.data) {
      setError(result.message || "Could not apply for this offer.");
      return;
    }
    setClaim(result.data);
    setCampaign(result.data.campaign);
  }

  if (loading) return <main className="mx-auto min-h-screen max-w-4xl space-y-4 bg-surface p-4 sm:p-8"><Skeleton className="h-8 w-52"/><Skeleton className="h-72 w-full"/><Skeleton className="h-56 w-full"/></main>;
  if (!campaign) return <main className="mx-auto min-h-screen max-w-4xl bg-surface p-4 sm:p-8"><Link href="/buyer/campaigns" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-muted"><ArrowLeft className="h-4 w-4"/>Back to offers</Link><p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error || "Campaign not found."}</p></main>;

  const canClaim = campaign.buyerClaimsRemaining > 0 && campaign.claimsRemaining > 0;
  return <main className="mx-auto min-h-screen max-w-4xl bg-surface p-4 sm:p-8">
    <Link href="/buyer/campaigns" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to offers</Link>
    {error ? <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
    <article className="space-y-5"><section className={`${cardCls} overflow-hidden p-0`}><div className="relative flex min-h-64 items-center justify-center bg-secondary/40">{campaign.imageUrl ? <img src={campaign.imageUrl} alt={`${campaign.title} reward`} className="max-h-[28rem] w-full object-contain"/> : <Gift className="h-20 w-20 text-primary"/>}</div><div className="p-6 sm:p-8"><p className="text-sm font-bold uppercase tracking-wider text-primary">{campaign.campaignType.replace("_", " ")}</p><h1 className="mt-2 text-3xl font-black text-foreground-heading">{campaign.title}</h1><p className="mt-3 whitespace-pre-wrap text-base leading-7 text-foreground-muted">{campaign.description}</p><p className="mt-4 text-sm font-bold text-foreground-heading">Offered by <span className="text-primary">{campaign.providerName}</span></p><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-foreground-muted"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>{campaign.locationName}</span>{campaign.timerEnabled && campaign.endsAt ? <span className="inline-flex items-center gap-1.5"><Timer className="h-4 w-4 text-primary"/>Ends {formatDate(campaign.endsAt)}</span> : null}</div></div></section>
      <section className={`${cardCls} grid gap-5 sm:grid-cols-3`}><Metric label="Reward" value={`${campaign.points.toLocaleString("en-IN")} points`}/><Metric label="Claims remaining" value={String(Math.max(0, campaign.claimsRemaining))}/><Metric label="Limit per buyer" value={String(campaign.perBuyerLimit)}/></section>
      {claim ? <section className={`${cardCls} border-status-success/30 bg-status-success-surface`}><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-status-success"/><div><h2 className="text-xl font-bold text-foreground-heading">Application successful</h2><p className="mt-1 text-sm text-foreground-muted">Show this claim code when the offer needs to be verified.</p><p className="mt-4 rounded-xl bg-white px-4 py-3 font-mono text-2xl font-bold tracking-wider text-primary">{claim.claimCode}</p></div></div></section> : <section className={`${cardCls} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}><div><h2 className="text-xl font-bold text-foreground-heading">Apply for this offer</h2><p className="mt-1 text-sm text-foreground-muted">Your claim will be reserved for this campaign and location.</p></div><button type="button" onClick={() => void applyForOffer()} disabled={busy || !canClaim} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Applying…" : canClaim ? "Apply for offer" : "Claim limit reached"}</button></section>}</article>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-semibold text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-black text-primary">{value}</p></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
