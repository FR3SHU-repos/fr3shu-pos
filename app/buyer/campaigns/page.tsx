"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Gift, MapPin, Timer } from "lucide-react";
import { campaignsApi } from "@/shared/lib/api";
import type { BuyerCampaign } from "@/shared/lib/api/campaigns";
import { cardCls, Skeleton } from "@/shared/components/ui";

const typeLabel: Record<BuyerCampaign["campaignType"], string> = {
  product: "Product reward",
  offer: "Special offer",
  online_cashback: "Online cashback",
};

export default function BuyerCampaignsPage() {
  const [items, setItems] = useState<BuyerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void campaignsApi.list().then((result) => {
      if (result.success && result.data) setItems(result.data.items);
      else setError(result.message || "Could not load campaigns.");
      setLoading(false);
    });
  }, []);

  return <main className="mx-auto min-h-screen max-w-4xl bg-surface p-4 sm:p-8">
    <Link href="/buyer" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to buyer dashboard</Link>
    <header className="mb-6"><p className="font-semibold text-primary">KOMOLA Buyer</p><h1 className="mt-1 text-3xl font-bold text-foreground-heading">Rewards and offers</h1><p className="mt-1 text-foreground-muted">Campaigns available for your registered location.</p></header>
    {error ? <section role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"><p>{error}</p>{/location/i.test(error) ? <Link href="/buyer/setup" className="mt-2 inline-block underline">Set my buyer location</Link> : null}</section> : null}
    {loading ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-80 w-full"/><Skeleton className="h-80 w-full"/></div> : null}
    {!loading && !error && items.length === 0 ? <section className={`${cardCls} text-center`}><Gift className="mx-auto h-10 w-10 text-primary"/><h2 className="mt-3 text-xl font-semibold text-foreground-heading">No offers available yet</h2><p className="mt-2 text-sm text-foreground-muted">New KOMOLA campaigns for your location will appear here.</p></section> : null}
    {!loading && items.length > 0 ? <div className="grid gap-5 sm:grid-cols-2">{items.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign}/>)}</div> : null}
  </main>;
}

function CampaignCard({ campaign }: { campaign: BuyerCampaign }) {
  return <Link href={`/buyer/campaigns/${campaign.slug || campaign.id}`} className={`${cardCls} group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md`}>
    <div className="relative flex h-48 items-center justify-center overflow-hidden bg-secondary/40">{campaign.imageUrl ? <img src={campaign.imageUrl} alt="" className="h-full w-full object-cover"/> : <Gift className="h-14 w-14 text-primary"/>}<span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-primary">{typeLabel[campaign.campaignType]}</span></div>
    <div className="space-y-3 p-5"><div><h2 className="text-xl font-bold text-foreground-heading group-hover:text-primary">{campaign.title}</h2><p className="mt-1 line-clamp-2 text-sm text-foreground-muted">{campaign.description}</p><p className="mt-2 text-xs font-bold text-foreground-muted">Offered by {campaign.providerName}</p></div>{campaign.buyerClaim && campaign.buyerClaim.status !== "cancelled" ? <p className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-primary">Already applied · {claimStatusLabel(campaign.buyerClaim.status)}</p> : null}<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-foreground-muted"><span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-primary"/>{campaign.locationName}</span>{campaign.timerEnabled && campaign.endsAt ? <span className="inline-flex items-center gap-1"><Timer className="h-4 w-4 text-primary"/>Ends {formatDate(campaign.endsAt)}</span> : null}</div><div className="flex items-end justify-between border-t border-border pt-3"><div><p className="text-xs text-foreground-muted">Reward</p><p className="text-lg font-bold text-primary">{campaign.points.toLocaleString("en-IN")} Komola points</p></div><p className="text-xs font-semibold text-foreground-muted">{campaign.buyerClaim && campaign.buyerClaim.status !== "cancelled" ? "Applied" : `${campaign.claimsRemaining} left`}</p></div></div>
  </Link>;
}

function claimStatusLabel(status: NonNullable<BuyerCampaign["buyerClaim"]>["status"]) {
  return status === "claimed" ? "Pending approval" : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
