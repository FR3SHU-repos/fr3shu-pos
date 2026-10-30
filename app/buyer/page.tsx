"use client";

import { Pagination } from "@/shared/components/Pagination";
import Image from "next/image";
import { useEffect, useState } from "react";
import { campaignsApi, identityApi, receiptsApi, rewardsApi } from "@/shared/lib/api";
import type { BuyerReceiptSummary } from "@/shared/lib/api/receipts";
import type { DiscoveryCode, PersonProfile } from "@/shared/lib/api/identity";
import type { RewardLedgerEntry, RewardSummary } from "@/shared/lib/api/rewards";
import { cardCls, Skeleton } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Gift,
  Loader2,
  Lock,
  ReceiptText,
  Share2,
  UsersRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { BuyerCampaign } from "@/shared/lib/api/campaigns";
import Link from "next/link";
import toast from "react-hot-toast";
import { copyText } from "@/shared/lib/clipboard";
import { KomoEmptyState } from "@/shared/components/mascot";
import {
  buyerCampaignsReady,
  buyerProfileReady,
  missingBuyerDetails,
} from "@/shared/lib/buyer/profile";

const PAGE_SIZE = 5;

export default function BuyerDashboardPage() {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [code, setCode] = useState<DiscoveryCode | null>(null);
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);
  const [receipts, setReceipts] = useState<BuyerReceiptSummary[]>([]);
  const [claimableReceipts, setClaimableReceipts] = useState<receiptsApi.ReceiptClaimCandidate[]>(
    [],
  );
  const [claimingReceiptID, setClaimingReceiptID] = useState<string | null>(null);
  const [rewardCursors, setRewardCursors] = useState<string[]>([""]);
  const [rewardPage, setRewardPage] = useState(1);
  const [rewardNextCursor, setRewardNextCursor] = useState<string | undefined>();
  const [rewardLoading, setRewardLoading] = useState(false);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptPages, setReceiptPages] = useState(1);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [campaignItems, setCampaignItems] = useState<BuyerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void identityApi.profile().then(async (person) => {
      if (!person.success || !person.data) {
        setError(person.message);
        setLoading(false);
        return;
      }
      setProfile(person.data);
      if (buyerCampaignsReady(person.data)) {
        void campaignsApi.list().then((campaigns) => {
          if (campaigns.success) setCampaignItems(campaigns.data?.items ?? []);
        });
      }
      if (!buyerProfileReady(person.data)) {
        setLoading(false);
        return;
      }
      const [discovery, rewards, history, purchases, claimable] = await Promise.all([
        identityApi.discoveryCode(),
        rewardsApi.summary(),
        rewardsApi.ledger(undefined, PAGE_SIZE),
        receiptsApi.list(PAGE_SIZE),
        receiptsApi.claimable(),
      ]);
      if (discovery.success) setCode(discovery.data);
      if (rewards.success) setSummary(rewards.data);
      else setError(rewards.message);
      if (history.success) {
        setEntries(history.data?.items ?? []);
        setRewardNextCursor(history.data?.nextCursor);
        setRewardCursors(history.data?.nextCursor ? ["", history.data.nextCursor] : [""]);
      }
      if (purchases.success) {
        setReceipts(purchases.data?.items ?? []);
        setReceiptPages(Math.max(1, purchases.data?.meta?.totalPages ?? 1));
      }
      if (claimable.success) setClaimableReceipts(claimable.data?.items ?? []);
      setLoading(false);
    });
  }, []);

  async function loadReceiptPage(page: number) {
    if (receiptsLoading || page < 1 || page > receiptPages) return;
    setReceiptsLoading(true);
    const result = await receiptsApi.list(PAGE_SIZE, page);
    setReceiptsLoading(false);
    if (!result.success || !result.data) {
      toast.error(result.message || "Could not load receipts");
      return;
    }
    setReceipts(result.data.items);
    setReceiptPage(result.data.meta.page);
    setReceiptPages(Math.max(1, result.data.meta.totalPages));
  }

  async function claimReceipt(id: string) {
    if (claimingReceiptID) return;
    setClaimingReceiptID(id);
    const result = await receiptsApi.claim(id);
    if (!result.success) {
      toast.error(result.message || "Could not claim this receipt");
      setClaimingReceiptID(null);
      return;
    }
    setClaimableReceipts((previous) => previous.filter((receipt) => receipt.id !== id));
    const [summaryResult, receiptsResult] = await Promise.all([
      rewardsApi.summary(),
      receiptsApi.list(PAGE_SIZE, receiptPage),
    ]);
    if (summaryResult.success) setSummary(summaryResult.data);
    if (receiptsResult.success && receiptsResult.data) {
      setReceipts(receiptsResult.data.items);
      setReceiptPage(receiptsResult.data.meta.page);
      setReceiptPages(Math.max(1, receiptsResult.data.meta.totalPages));
    }
    toast.success("Receipt claimed. Rewards are now linked to your buyer account.");
    setClaimingReceiptID(null);
  }

  async function loadRewardPage(page: number) {
    if (rewardLoading || page < 1 || page > rewardCursors.length || page === rewardPage) return;
    const cursor = rewardCursors[page - 1] || undefined;
    setRewardLoading(true);
    const result = await rewardsApi.ledger(cursor, PAGE_SIZE);
    setRewardLoading(false);
    if (!result.success || !result.data) {
      toast.error(result.message || "Could not load reward history");
      return;
    }
    setEntries(result.data.items);
    setRewardPage(page);
    setRewardNextCursor(result.data.nextCursor);
    setRewardCursors((previous) => {
      const next = previous.slice(0, page);
      if (result.data?.nextCursor) next[page] = result.data.nextCursor;
      return next;
    });
  }

  async function shareCode() {
    if (!code) return;
    if (navigator.share)
      await navigator.share({
        title: "My KOMOLA buyer code",
        text: `Use my buyer code ${code.code}`,
        url: code.url,
      });
    else if (await copyText(code.url)) toast.success("Buyer-code link copied");
    else toast.error("Could not copy the buyer-code link");
  }

  async function copyCode() {
    if (!code) return;
    if (!(await copyText(code.code))) {
      toast.error("Could not copy the buyer code");
      return;
    }
    setCopied(true);
    toast.success("Buyer code copied");
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading)
    return (
      <main className="mx-auto min-h-screen max-w-4xl space-y-4 bg-background p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </main>
    );

  const profileReady = buyerProfileReady(profile);
  const campaignsReady = buyerCampaignsReady(profile);
  const missingDetails = missingBuyerDetails(profile);

  const initials = (profile?.displayName || "B")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const lockedCoins = summary?.reservedCampaignCoins ?? 0;
  const typeLabel: Record<BuyerCampaign["campaignType"], string> = {
    product: "Product reward",
    offer: "Special offer",
    online_cashback: "Online cashback",
  };
  const typeArt: Record<BuyerCampaign["campaignType"], string> = {
    product: "var(--art-product)",
    offer: "var(--art-offer)",
    online_cashback: "var(--art-cashback)",
  };

  const hero = (
    <section
      aria-label="Komola Coin balance"
      className="relative overflow-hidden rounded-3xl bg-surface-card p-6"
      style={{
        backgroundImage:
          "radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--color-primary) 26%, transparent), transparent 55%)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground-muted">Available points</p>
        {lockedCoins > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            <Lock className="h-3.5 w-3.5" />
            {lockedCoins.toLocaleString("en-IN")} locked
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-6xl font-bold tracking-[-0.03em] text-foreground-heading">
        {(summary?.availableCoins ?? 0).toLocaleString("en-IN")}
        <span className="ml-2 text-xl font-semibold text-foreground-muted">pts</span>
      </p>
      <p className="mt-3 text-sm text-foreground-muted">
        {summary?.eligibleRemainderMinor
          ? `${formatPaise(summary.eligibleRemainderMinor)} carried toward your next coin`
          : "Shop at KOMOLA sellers to earn more points."}
      </p>
    </section>
  );

  const codeCard = (
    <section
      className="rounded-3xl bg-surface-card p-6 text-center"
      aria-labelledby="buyer-code-title"
    >
      <h2 id="buyer-code-title" className="text-sm font-medium text-foreground-muted">
        Show this at any KOMOLA seller to collect rewards
      </h2>
      {!profileReady ? (
        <div className="mt-5 rounded-2xl bg-status-warning-surface p-4 text-sm text-status-warning">
          Your buyer code will appear after you enter your phone number, location, and address.{" "}
          <Link href="/buyer/setup" className="font-semibold underline">
            Enter buyer details
          </Link>
        </div>
      ) : (
        <>
          <div className="mx-auto mt-5 w-fit rounded-3xl bg-white p-4">
            {code ? (
              <QRCodeSVG
                value={code.code}
                size={208}
                level="M"
                marginSize={1}
                title="Buyer code QR"
              />
            ) : (
              <div className="h-52 w-52" />
            )}
          </div>
          <p className="my-5 break-all font-mono text-xl font-bold tracking-[0.08em] text-foreground-heading">
            {code?.code ?? "Unavailable"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!code}
              onClick={copyCode}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-muted text-sm font-semibold text-foreground-heading disabled:opacity-50"
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              disabled={!code}
              onClick={shareCode}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Share2 className="h-5 w-5" />
              Share
            </button>
          </div>
        </>
      )}
    </section>
  );

  const offersHref = campaignsReady ? "/buyer/campaigns" : "/buyer/setup";
  const offersStrip = (
    <section aria-labelledby="near-you-title">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="near-you-title"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted"
        >
          Offers near you
        </h2>
        <Link href={offersHref} className="text-sm font-semibold text-primary">
          {campaignsReady ? "View all" : "Finish setup"}
        </Link>
      </div>
      {campaignsReady && campaignItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {campaignItems.slice(0, 2).map((c) => {
            const applied = Boolean(c.buyerClaim && c.buyerClaim.status !== "cancelled");
            return (
              <Link
                key={c.id}
                href={`/buyer/campaigns/${c.slug || c.id}`}
                className="overflow-hidden rounded-3xl bg-surface-card transition active:scale-[0.99]"
              >
                <div
                  className="relative flex h-32 items-end p-3"
                  style={{ backgroundImage: c.imageUrl ? undefined : typeArt[c.campaignType] }}
                >
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                  <span className="relative rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">
                    {typeLabel[c.campaignType]}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground-heading">{c.title}</p>
                    {applied ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-success-surface px-2.5 py-1 text-xs font-bold text-status-success">
                        <Check className="h-3 w-3" />
                        Applied
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">Offered by {c.providerName}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Link href={offersHref} className="flex items-center gap-3 rounded-3xl bg-surface-card p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Gift className="h-5 w-5" />
          </span>
          <span className="flex-1 text-sm font-semibold text-foreground-heading">
            {campaignsReady
              ? "Browse offers for your location"
              : "Complete your profile to view offers"}
          </span>
        </Link>
      )}
    </section>
  );

  const inviteRow = (
    <section
      aria-labelledby="seller-referrals-title"
      className="flex items-center gap-3 rounded-3xl bg-surface-card p-4"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
        <UsersRound className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="seller-referrals-title" className="text-sm font-semibold text-foreground-heading">
          Invite a seller, earn Komo Coins
        </h2>
        <p className="mt-0.5 text-xs text-foreground-muted">
          Share your buyer code with an agri seller.
        </p>
      </div>
      <Link
        href="/buyer/referrals"
        className="inline-flex min-h-10 items-center rounded-full bg-surface-muted px-4 text-sm font-semibold text-foreground-heading"
      >
        Invite
      </Link>
    </section>
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-background p-4 pb-32 sm:p-8 sm:pb-32 lg:pb-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground-muted">KOMOLA Buyer</p>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">
            {profile?.displayName ? `Hello, ${profile.displayName}` : "Your rewards"}
          </h1>
        </div>
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary lg:hidden"
          aria-hidden="true"
        >
          {initials}
        </span>
      </header>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-start">
        <div className="order-0 lg:order-none lg:col-span-2">
          {!profileReady ? (
            <section
              className={`${cardCls} border-primary/30 bg-primary/5`}
              aria-labelledby="complete-profile-title"
            >
              <div>
                <p className="font-semibold text-primary">Buyer account setup</p>
                <h2
                  id="complete-profile-title"
                  className="mt-1 text-xl font-bold text-foreground-heading"
                >
                  Add your details to unlock your buyer account
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  Enter {missingDetails.join(", ")} to get your buyer code and receive purchase
                  rewards.
                </p>
              </div>
              <Link
                href="/buyer/setup"
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground sm:mt-5"
              >
                Enter buyer details <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          ) : null}
        </div>
        <div className="order-0 lg:order-none lg:col-span-2">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-status-danger-surface p-4 text-status-danger"
            >
              {error}
            </p>
          )}
        </div>
        <div className="contents lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-4">
          <div className="order-2 lg:order-none">{codeCard}</div>
          <div className="order-3 lg:order-none">
            {claimableReceipts.length > 0 ? (
              <section
                className={`${cardCls} border-primary/30 bg-primary/5`}
                aria-labelledby="receipt-claim-title"
              >
                <div className="flex items-start gap-3">
                  <Bell className="mt-1 h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold text-primary">Receipt claim notification</p>
                    <h2
                      id="receipt-claim-title"
                      className="mt-1 text-xl font-bold text-foreground-heading"
                    >
                      An edited receipt is ready for your confirmation
                    </h2>
                    <p className="mt-1 text-sm text-foreground-muted">
                      A seller corrected this receipt after checkout. Claim it only if this purchase
                      is yours. This confirmation cannot move rewards from another buyer.
                    </p>
                  </div>
                </div>
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
                  {claimableReceipts.map((receipt) => (
                    <li
                      key={receipt.id}
                      className="flex flex-col justify-between gap-3 px-3 py-3 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-semibold text-foreground-heading">{receipt.storeName}</p>
                        <p className="text-sm text-foreground-muted">
                          {receipt.receiptNo} ·{" "}
                          {new Date(receipt.purchasedAt).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {formatPaise(receipt.totalMinor)} · {receipt.locationName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void claimReceipt(receipt.id)}
                        disabled={claimingReceiptID !== null}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {claimingReceiptID === receipt.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        {claimingReceiptID === receipt.id ? "Claiming…" : "Claim this receipt"}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
        <div className="contents lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:gap-4">
          <div className="order-1 lg:order-none">{hero}</div>
          <div className="order-4 lg:order-none">{offersStrip}</div>
          <div className="order-5 lg:order-none">{inviteRow}</div>
          <div className="order-6 lg:order-none">
            <section className="grid grid-cols-2 gap-3" aria-label="Purchase totals">
              <div className={cardCls}>
                <p className="text-sm text-foreground-muted">Total spend</p>
                <p className="mt-2 text-2xl font-bold">
                  {formatPaise(summary?.eligibleSpendMinor ?? 0)}
                </p>
              </div>
              <div className={cardCls}>
                <p className="text-sm text-foreground-muted">Purchases</p>
                <p className="mt-2 text-2xl font-bold">{summary?.verifiedPurchaseCount ?? 0}</p>
              </div>
              <div className={cardCls}>
                <p className="text-sm text-foreground-muted">Coins earned</p>
                <p className="mt-2 text-2xl font-bold">{summary?.lifetimeEarnedCoins ?? 0} coins</p>
              </div>
            </section>
          </div>
          <div className="order-7 lg:order-none">
            <section className={`${cardCls}`} aria-labelledby="reward-history-title">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText className="h-6 w-6 text-primary" />
                <h2 id="reward-history-title" className="text-xl font-semibold">
                  Reward history
                </h2>
              </div>
              {entries.length === 0 ? (
                <KomoEmptyState
                  action="reward"
                  title="No rewards yet"
                  description="Your Komola Coins will appear after a seller completes a purchase linked with your buyer code."
                />
              ) : (
                <>
                  <div className="relative">
                    {rewardLoading ? (
                      <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-surface-card/75">
                        <Loader2
                          className="h-6 w-6 animate-spin text-primary"
                          aria-label="Loading reward history"
                        />
                      </div>
                    ) : null}
                    <ul className="divide-y divide-border">
                      {entries.map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between gap-4 py-4">
                          <div>
                            <p className="font-medium text-foreground-heading">
                              {entry.reason === "Verified farm-produce purchase"
                                ? "Purchase reward"
                                : entry.reason}
                            </p>
                            <p className="mt-1 text-xs text-foreground-muted">
                              {new Date(entry.effectiveAt).toLocaleString("en-IN")} ·{" "}
                              {formatPaise(Math.abs(entry.eligibleAmountMinor))}
                            </p>
                          </div>
                          <p
                            className={`text-lg font-bold ${entry.coinAmount >= 0 ? "text-status-success" : "text-status-danger"}`}
                          >
                            {entry.coinAmount >= 0 ? "+" : ""}
                            {entry.coinAmount}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Pagination
                    page={rewardPage}
                    hasNext={Boolean(rewardNextCursor)}
                    onPageChange={(next) => void loadRewardPage(next)}
                    disabled={rewardLoading}
                    bordered
                    chevrons
                    label="Reward history pages"
                    className="mt-4"
                  />
                </>
              )}
            </section>
          </div>
          <div className="order-8 lg:order-none">
            <section className={`${cardCls}`} aria-labelledby="receipts-title">
              <div className="mb-4 flex items-center gap-2">
                <Download className="h-6 w-6 text-primary" />
                <h2 id="receipts-title" className="text-xl font-semibold">
                  My e-receipts
                </h2>
              </div>
              {receipts.length === 0 ? (
                <KomoEmptyState
                  action="shopping"
                  title="No e-receipts yet"
                  description="Receipts linked with your buyer code or verified mobile number will appear here."
                />
              ) : (
                <>
                  <div className="relative">
                    {receiptsLoading ? (
                      <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-surface-card/75">
                        <Loader2
                          className="h-6 w-6 animate-spin text-primary"
                          aria-label="Loading receipts"
                        />
                      </div>
                    ) : null}
                    <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto pr-1">
                      {receipts.map((receipt) => (
                        <li
                          key={receipt.id}
                          className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <p className="font-semibold text-foreground-heading">
                              {receipt.storeName}
                            </p>
                            <p className="text-sm text-foreground-muted">
                              {receipt.receiptNo} ·{" "}
                              {new Date(receipt.purchasedAt).toLocaleString("en-IN")}
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {formatPaise(receipt.totalMinor)} · {receipt.coinsEarned} coin
                              {receipt.coinsEarned === 1 ? "" : "s"}
                            </p>
                          </div>
                          <Link
                            href={`/buyer/receipts/${receipt.id}`}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface-muted px-5 font-semibold text-primary"
                          >
                            <Eye className="h-4 w-4" />
                            View & download
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Pagination
                    page={receiptPage}
                    pages={receiptPages}
                    onPageChange={(next) => void loadReceiptPage(next)}
                    disabled={receiptsLoading}
                    bordered
                    chevrons
                    label="Receipt pages"
                    className="mt-4"
                  />
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
