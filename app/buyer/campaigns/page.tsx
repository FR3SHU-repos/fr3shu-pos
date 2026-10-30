"use client";

import { Pagination } from "@/shared/components/Pagination";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Gift, MapPin, Phone, Search, Timer } from "lucide-react";
import { campaignsApi, identityApi } from "@/shared/lib/api";
import type { BuyerCampaign } from "@/shared/lib/api/campaigns";
import type { PersonProfile } from "@/shared/lib/api/identity";
import { cardCls, Skeleton } from "@/shared/components/ui";
import { buyerCampaignsReady, missingBuyerCampaignDetails } from "@/shared/lib/buyer/profile";

const typeLabel: Record<BuyerCampaign["campaignType"], string> = {
  product: "Product reward",
  offer: "Special offer",
  online_cashback: "Online cashback",
};

export default function BuyerCampaignsPage() {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [items, setItems] = useState<BuyerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | BuyerCampaign["campaignType"]>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void identityApi.profile().then(async (profileResult) => {
      if (!profileResult.success || !profileResult.data) {
        setError(profileResult.message || "Could not load your buyer profile.");
        setLoading(false);
        return;
      }
      setProfile(profileResult.data);
      if (!buyerCampaignsReady(profileResult.data)) {
        setSetupRequired(true);
        setLoading(false);
        return;
      }
      const result = await campaignsApi.list();
      if (result.success && result.data) setItems(result.data.items);
      else setError(result.message || "Could not load campaigns.");
      setLoading(false);
    });
  }, []);

  const appliedItems = items.filter(
    (campaign) => campaign.buyerClaim && campaign.buyerClaim.status !== "cancelled",
  );
  const availableItems = items.filter(
    (campaign) => !campaign.buyerClaim || campaign.buyerClaim.status === "cancelled",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredApplied = appliedItems.filter((campaign) =>
    matchesCampaign(campaign, normalizedQuery, typeFilter),
  );
  const filteredAvailable = availableItems.filter((campaign) =>
    matchesCampaign(campaign, normalizedQuery, typeFilter),
  );
  const filtered = [...filteredApplied, ...filteredAvailable];
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice((page - 1) * 10, page * 10);
  const visibleApplied = visible.filter((campaign) =>
    filteredApplied.some((item) => item.id === campaign.id),
  );
  const visibleAvailable = visible.filter((campaign) =>
    filteredAvailable.some((item) => item.id === campaign.id),
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-background p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
      <Link
        href="/buyer"
        className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm font-semibold text-foreground-body"
      >
        <ArrowLeft className="h-4 w-4" />
        Rewards
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">Offers</h1>
        <p className="mt-1 text-sm text-foreground-muted">Campaigns available for your location.</p>
      </header>
      {setupRequired ? (
        <section
          className={`${cardCls} mb-5 border-primary/30 bg-primary/5`}
          aria-labelledby="campaign-profile-title"
        >
          <p className="font-semibold text-primary">Buyer account setup</p>
          <h2
            id="campaign-profile-title"
            className="mt-1 text-xl font-bold text-foreground-heading"
          >
            Complete your buyer details first
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Enter {missingBuyerCampaignDetails(profile).join(", ")} to view offers available in your
            location.
          </p>
          <Link
            href="/buyer/setup"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            Enter buyer details
          </Link>
        </section>
      ) : null}
      {error ? (
        <section
          role="alert"
          className="mb-5 rounded-xl bg-status-danger-surface p-4 text-sm font-semibold text-status-danger"
        >
          <p>{error}</p>
          {/location|buyer account|address/i.test(error) ? (
            <Link href="/buyer/setup" className="mt-2 inline-block underline">
              Complete buyer details
            </Link>
          ) : null}
        </section>
      ) : null}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <section className={`${cardCls} text-center`}>
          <Gift className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-xl font-semibold text-foreground-heading">
            No offers available yet
          </h2>
          <p className="mt-2 text-sm text-foreground-muted">
            New KOMOLA campaigns for your location will appear here.
          </p>
        </section>
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-border bg-surface-card py-2 pl-9 pr-3 text-sm text-foreground-heading"
                placeholder="Search campaigns or stores"
                aria-label="Search campaigns"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as typeof typeFilter);
                setPage(1);
              }}
              className="min-h-12 rounded-full bg-surface-card px-4 text-sm text-foreground-heading"
              aria-label="Filter campaigns by type"
            >
              <option value="all">All types</option>
              <option value="product">Product rewards</option>
              <option value="offer">Special offers</option>
              <option value="online_cashback">Online cashback</option>
            </select>
          </div>
          <section aria-labelledby="applied-rewards-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="applied-rewards-title"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted"
                >
                  Already applied
                </h2>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                {appliedItems.length} applied
              </span>
            </div>
            {visibleApplied.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {visibleApplied.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            ) : (
              <div className={`${cardCls} border-dashed text-sm text-foreground-muted`}>
                {filteredApplied.length
                  ? "No applied rewards match your search."
                  : "You have not applied for any rewards yet."}
              </div>
            )}
          </section>
          <section aria-labelledby="available-rewards-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="available-rewards-title"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted"
                >
                  Available and upcoming
                </h2>
              </div>
              <span className="rounded-full bg-secondary/60 px-3 py-1 text-sm font-bold text-foreground-heading">
                {availableItems.length} available
              </span>
            </div>
            {visibleAvailable.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {visibleAvailable.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            ) : (
              <div className={`${cardCls} border-dashed text-sm text-foreground-muted`}>
                {filteredAvailable.length
                  ? "No available rewards match your search."
                  : "You have applied for all available rewards in your area."}
              </div>
            )}
          </section>
          <Pagination
            page={page}
            pages={pageCount}
            onPageChange={setPage}
            bordered
            label="Campaign pages"
            detail={`${filtered.length} campaigns`}
          />
        </div>
      ) : null}
    </main>
  );
}

function matchesCampaign(
  campaign: BuyerCampaign,
  query: string,
  type: "all" | BuyerCampaign["campaignType"],
) {
  if (type !== "all" && campaign.campaignType !== type) return false;
  if (!query) return true;
  return [campaign.title, campaign.description, campaign.providerName, campaign.locationName].some(
    (value) => value.toLowerCase().includes(query),
  );
}

function CampaignCard({ campaign }: { campaign: BuyerCampaign }) {
  const applied = Boolean(campaign.buyerClaim && campaign.buyerClaim.status !== "cancelled");
  const upcoming = isUpcoming(campaign);

  return (
    <Link
      href={`/buyer/campaigns/${campaign.slug || campaign.id}`}
      className={`${cardCls} group overflow-hidden p-0 transition active:scale-[0.99] hover:bg-surface-muted`}
    >
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-secondary/40">
        {campaign.imageUrl ? (
          <Image
            src={campaign.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <Gift className="h-14 w-14 text-primary" />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-surface-card/90 px-3 py-1 text-xs font-bold text-primary">
          {typeLabel[campaign.campaignType]}
        </span>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <h2 className="text-xl font-bold text-foreground-heading group-hover:text-primary">
            {campaign.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-foreground-muted">{campaign.description}</p>
          <p className="mt-2 text-xs font-bold text-foreground-muted">
            Offered by {campaign.providerName}
          </p>
          {campaign.providerPhone ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground-muted">
              <Phone className="h-3.5 w-3.5 text-primary" />
              Contact: {campaign.providerPhone}
            </p>
          ) : null}
        </div>
        {upcoming ? (
          <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            Starts {formatDate(campaign.startsAt!)}
          </p>
        ) : null}
        {campaign.status !== "published" ? (
          <p className="inline-flex rounded-full border border-status-success bg-status-success px-3 py-1 text-xs font-bold capitalize text-white">
            Claimed · {campaign.status}
          </p>
        ) : null}
        {applied ? (
          <p className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-primary">
            Already applied · {claimStatusLabel(campaign.buyerClaim!.status)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-foreground-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4 text-primary" />
            {campaign.locationName}
          </span>
          {campaign.timerEnabled && campaign.endsAt ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="h-4 w-4 text-primary" />
              Ends {formatDate(campaign.endsAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-xs text-foreground-muted">Reward</p>
            <p className="text-lg font-bold text-primary">
              {campaign.points.toLocaleString("en-IN")} Komola points
            </p>
          </div>
          {applied ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
              View claim <ArrowRight className="h-4 w-4" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
              {upcoming ? "View details" : "View offer & apply"} <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function isUpcoming(campaign: BuyerCampaign) {
  return (
    campaign.status === "published" &&
    Boolean(campaign.startsAt) &&
    new Date(campaign.startsAt!).getTime() > Date.now()
  );
}

function claimStatusLabel(status: NonNullable<BuyerCampaign["buyerClaim"]>["status"]) {
  return status === "claimed"
    ? "Pending approval"
    : status === "approved"
      ? "Approved"
      : status === "delivered"
        ? "Reward delivered"
        : status === "confirmed"
          ? "Receipt confirmed"
          : "Redeemed";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
