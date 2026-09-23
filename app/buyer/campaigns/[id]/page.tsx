"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Gift, MapPin, Timer } from "lucide-react";
import { campaignsApi } from "@/shared/lib/api";
import type {
  BuyerCampaign,
  BuyerCampaignClaim,
  BuyerFulfillmentMethod,
} from "@/shared/lib/api/campaigns";
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
      if (result.success && result.data) {
        setCampaign(result.data);
        setClaim(result.data.buyerClaim ?? null);
      } else setError(result.message || "Could not load this campaign.");
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

  if (loading)
    return (
      <main className="mx-auto min-h-screen max-w-4xl space-y-4 bg-surface p-4 sm:p-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
      </main>
    );
  if (!campaign)
    return (
      <main className="mx-auto min-h-screen max-w-4xl bg-surface p-4 sm:p-8">
        <Link
          href="/buyer/campaigns"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to offers
        </Link>
        <p
          role="alert"
          className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
        >
          {error || "Campaign not found."}
        </p>
      </main>
    );

  const fulfillmentMethod: BuyerFulfillmentMethod =
    campaign.deliveryOptions[0] ?? "home_delivery";
  const hasApplied = Boolean(
    campaign.buyerClaim && campaign.buyerClaim.status !== "cancelled",
  );
  const hasDeliveryAddress = isCompleteAddress(campaign.buyerProfile?.address);
  const canClaim =
    !hasApplied &&
    campaign.buyerClaimsRemaining > 0 &&
    campaign.claimsRemaining > 0 &&
    (fulfillmentMethod !== "home_delivery" || hasDeliveryAddress);
  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-surface p-4 sm:p-8">
      <Link
        href="/buyer/campaigns"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to offers
      </Link>
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      ) : null}
      <article className="space-y-5">
        <section className={`${cardCls} overflow-hidden p-0`}>
          <div className="relative flex min-h-64 items-center justify-center bg-secondary/40">
            {campaign.imageUrl ? (
              <img
                src={campaign.imageUrl}
                alt={`${campaign.title} reward`}
                className="max-h-[28rem] w-full object-contain"
              />
            ) : (
              <Gift className="h-20 w-20 text-primary" />
            )}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              {campaign.campaignType.replace("_", " ")}
            </p>
            <h1 className="mt-2 text-3xl font-black text-foreground-heading">
              {campaign.title}
            </h1>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-foreground-muted">
              {campaign.description}
            </p>
            <p className="mt-4 text-sm font-bold text-foreground-heading">
              Offered by{" "}
              <span className="text-primary">{campaign.providerName}</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-foreground-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                {campaign.locationName}
              </span>
              {campaign.timerEnabled && campaign.endsAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-primary" />
                  Ends {formatDate(campaign.endsAt)}
                </span>
              ) : null}
            </div>
          </div>
        </section>
        <section className={`${cardCls} grid gap-5 sm:grid-cols-3`}>
          <Metric
            label="Reward"
            value={`${campaign.points.toLocaleString("en-IN")} points`}
          />
          <Metric
            label="Claims remaining"
            value={String(Math.max(0, campaign.claimsRemaining))}
          />
          <Metric
            label="Limit per buyer"
            value={String(campaign.perBuyerLimit)}
          />
        </section>
        {claim && claim.status !== "cancelled" ? (
          <section
            className={`${cardCls} border-status-success/30 bg-status-success-surface`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-status-success" />
              <div>
                <h2 className="text-xl font-bold text-foreground-heading">
                  Already applied
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {claim.status === "claimed"
                    ? `Your ${claim.points.toLocaleString("en-IN")} points are locked while the Rewardor reviews this claim.`
                    : claim.status === "approved"
                      ? campaign.approvalMode === "automatic"
                        ? "Approved automatically. Your reward is ready to redeem."
                        : "Approved by the Rewardor. Your reward is ready to redeem."
                      : `Your claim is ${claim.status}.`}
                </p>
                <p className="mt-4 rounded-xl bg-white px-4 py-3 font-mono text-2xl font-bold tracking-wider text-primary">
                  {claim.claimCode}
                </p>
                <p className="mt-3 text-sm text-foreground-muted">
                  {claim.fulfillmentMethod === "home_delivery"
                    ? `Delivery to ${formatAddress(claim.deliveryAddress)}`
                    : claim.fulfillmentMethod === "store_pickup"
                      ? `Collect at ${claim.pickupStoreName} · ${claim.pickupStorePhone} · ${formatAddress(claim.pickupStoreAddress)}`
                      : "Redeem online using the campaign instructions."}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className={`${cardCls} space-y-5`}>
            <div>
              <h2 className="text-xl font-bold text-foreground-heading">
                Apply for this offer
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                The Rewardor has selected{" "}
                <strong>{fulfillmentLabel(fulfillmentMethod)}</strong> for this
                offer.
              </p>
              {fulfillmentMethod === "home_delivery" && !hasDeliveryAddress ? (
                <p className="mt-2 text-sm font-semibold text-red-700">
                  Add your complete delivery address in your profile before
                  applying.
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-bold text-foreground-heading">
                {fulfillmentLabel(fulfillmentMethod)}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                {fulfillmentMethod === "home_delivery"
                  ? formatAddress(campaign.buyerProfile?.address)
                  : fulfillmentMethod === "store_pickup"
                    ? `${campaign.pickupStoreName ?? "Store"} · ${campaign.pickupStorePhone ?? ""} · ${formatAddress(campaign.pickupStoreAddress)}`
                    : "Follow the online redemption instructions provided by the Rewardor."}
              </p>
              {fulfillmentMethod === "home_delivery" && !hasDeliveryAddress ? (
                <Link
                  href="/buyer/setup"
                  className="mt-2 inline-block text-sm font-bold text-primary underline"
                >
                  Update delivery address
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void applyForOffer()}
              disabled={busy || !canClaim}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Applying…"
                : hasApplied
                  ? "Already applied"
                  : campaign.buyerClaimsRemaining <= 0
                    ? "Claim limit reached"
                    : fulfillmentMethod === "home_delivery" &&
                        !hasDeliveryAddress
                      ? "Add delivery address first"
                      : canClaim
                        ? "Apply for offer"
                        : "Unavailable"}
            </button>
          </section>
        )}
      </article>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-primary">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fulfillmentLabel(method: BuyerFulfillmentMethod): string {
  return method === "home_delivery"
    ? "Home delivery"
    : method === "store_pickup"
      ? "Collect in store"
      : "Online redemption";
}

function formatAddress(address?: Record<string, string>) {
  if (!address) return "Add a complete address in your profile";
  return (
    [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(", ") || "Add a complete address in your profile"
  );
}

function isCompleteAddress(address?: Record<string, string>) {
  return Boolean(
    address?.line1 &&
    address.city &&
    address.state &&
    /^\d{6}$/.test(address.postalCode ?? "") &&
    address.country?.toLowerCase() === "india",
  );
}
