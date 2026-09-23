"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  Gift,
  LockKeyhole,
  WalletCards,
} from "lucide-react";
import { campaignsApi, rewardsApi } from "@/shared/lib/api";
import type {
  BuyerRewardClaim,
  BuyerCampaign,
} from "@/shared/lib/api/campaigns";
import type { RewardSummary } from "@/shared/lib/api/rewards";
import { cardCls, Skeleton } from "@/shared/components/ui";

export default function BuyerWalletPage() {
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [claims, setClaims] = useState<BuyerRewardClaim[]>([]);
  const [available, setAvailable] = useState<BuyerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      rewardsApi.summary(),
      campaignsApi.wallet(),
      campaignsApi.list(),
    ]).then(([summaryResult, walletResult, campaignsResult]) => {
      if (summaryResult.success) setSummary(summaryResult.data);
      else setError(summaryResult.message);
      if (walletResult.success) setClaims(walletResult.data?.items ?? []);
      else setError(walletResult.message);
      if (campaignsResult.success)
        setAvailable(campaignsResult.data?.items ?? []);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <main className="mx-auto min-h-screen max-w-5xl space-y-4 bg-surface p-4 sm:p-8">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-surface p-4 sm:p-8">
      <header className="mb-6">
        <p className="font-semibold text-primary">KOMOLA Buyer</p>
        <h1 className="text-3xl font-bold text-foreground-heading">
          My wallet
        </h1>
        <p className="mt-1 text-foreground-muted">
          Your points, claimed rewards, and rewards available in your location.
        </p>
      </header>
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </p>
      ) : null}
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Wallet balances"
      >
        <WalletMetric
          icon={<Coins />}
          label="Available points"
          value={(summary?.availableCoins ?? 0).toLocaleString("en-IN")}
        />
        <WalletMetric
          icon={<LockKeyhole />}
          label="Locked points"
          value={(summary?.reservedCampaignCoins ?? 0).toLocaleString("en-IN")}
        />
        <WalletMetric
          icon={<Gift />}
          label="Rewards claimed"
          value={String(claims.length)}
        />
        <WalletMetric
          icon={<CheckCircle2 />}
          label="Points redeemed"
          value={(summary?.lifetimeRedeemedCoins ?? 0).toLocaleString("en-IN")}
        />
      </section>
      <section className={`${cardCls} mt-6`} aria-labelledby="claimed-title">
        <div className="mb-4 flex items-center gap-2">
          <WalletCards className="h-6 w-6 text-primary" />
          <h2
            id="claimed-title"
            className="text-xl font-semibold text-foreground-heading"
          >
            Claimed rewards
          </h2>
        </div>
        {claims.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            Rewards you claim will appear here automatically.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </ul>
        )}
      </section>
      <section className={`${cardCls} mt-6`} aria-labelledby="available-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2
              id="available-title"
              className="text-xl font-semibold text-foreground-heading"
            >
              Available rewards
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Published campaigns available for your registered location.
            </p>
          </div>
          <Link
            href="/buyer/campaigns"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View all
          </Link>
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            There are no available rewards right now.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {available.slice(0, 6).map((campaign) => (
              <li
                key={campaign.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <Link
                  href={`/buyer/campaigns/${campaign.slug}`}
                  className="font-bold text-foreground-heading hover:text-primary"
                >
                  {campaign.title}
                </Link>
                <p className="mt-1 text-sm text-foreground-muted">
                  Offered by {campaign.providerName} ·{" "}
                  {campaign.points.toLocaleString("en-IN")} points
                </p>
                {campaign.buyerClaim ? (
                  <p className="mt-2 text-xs font-semibold text-primary">
                    Already applied
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-foreground-muted">
                    {campaign.claimsRemaining} remaining
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function WalletMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-5">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <p className="m-0 text-sm font-semibold text-foreground-muted">
          {label}
        </p>
      </div>
      <p className="m-0 mt-3 text-3xl font-black text-foreground-heading">
        {value}
      </p>
    </div>
  );
}

function ClaimRow({ claim }: { claim: BuyerRewardClaim }) {
  const status =
    claim.status === "claimed"
      ? "Pending approval"
      : claim.status === "approved"
        ? "Ready to redeem"
        : "Redeemed";
  const fulfilment =
    claim.fulfillmentMethod === "online_redemption"
      ? "Online redemption"
      : claim.fulfillmentMethod === "home_delivery"
        ? `Home delivery · ${formatAddress(claim.deliveryAddress)}`
        : `Collect in store · ${claim.pickupStoreName ?? "Store"} · ${claim.pickupStorePhone ?? ""}`;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/buyer/campaigns/${claim.campaign.slug}`}
            className="font-bold text-foreground-heading hover:text-primary"
          >
            {claim.campaign.title}
          </Link>
          <p className="mt-1 text-sm text-foreground-muted">
            Offered by {claim.campaign.providerName} ·{" "}
            {claim.points.toLocaleString("en-IN")} points
          </p>
        </div>
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-primary">
          {status}
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
        <p className="font-bold text-foreground-heading">
          Claim code:{" "}
          <span className="font-mono text-primary">{claim.claimCode}</span>
        </p>
        <p className="mt-1 text-foreground-muted">{fulfilment}</p>
      </div>
    </li>
  );
}

function formatAddress(address: Record<string, string>): string {
  return (
    [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(", ") || "Address not available"
  );
}
