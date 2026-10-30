"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Coins, Link2, Store, UsersRound } from "lucide-react";
import { identityApi } from "@/shared/lib/api";
import type { BuyerReferral } from "@/shared/lib/api/identity";
import { cardCls, Skeleton } from "@/shared/components/ui";
import { formatPaise } from "@/shared/lib/money";

export default function BuyerReferralsPage() {
  const [referrals, setReferrals] = useState<BuyerReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void identityApi.referrals().then((result) => {
      if (!result.success) {
        setError(result.message || "Could not load your seller referrals.");
      } else {
        setReferrals(result.data?.items ?? []);
      }
      setLoading(false);
    });
  }, []);

  const totals = useMemo(
    () => ({
      linked: referrals.length,
      active: referrals.filter((referral) => referral.status === "active").length,
      awardedCoins: referrals.reduce((total, referral) => total + referral.awardedCoins, 0),
      eligibleSalesMinor: referrals.reduce(
        (total, referral) => total + referral.eligibleSalesMinor,
        0,
      ),
    }),
    [referrals],
  );

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl space-y-4 bg-background p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-80" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-background p-4 pb-32 sm:p-8 sm:pb-32 xl:pb-8">
      <header className="mb-5">
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">Referrals</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Sellers linked to your buyer code and the coins they earned you.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-status-danger-surface p-4 text-status-danger">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Referral totals">
        <MetricCard
          icon={<UsersRound className="h-5 w-5" />}
          label="Linked sellers"
          value={totals.linked.toLocaleString("en-IN")}
          detail={`${totals.active.toLocaleString("en-IN")} active`}
        />
        <MetricCard
          icon={<Coins className="h-5 w-5" />}
          label="Referral points earned"
          value={totals.awardedCoins.toLocaleString("en-IN")}
          detail="Across all linked sellers"
        />
        <MetricCard
          icon={<Store className="h-5 w-5" />}
          label="Eligible seller sales"
          value={formatPaise(totals.eligibleSalesMinor)}
          detail="Cumulative eligible value"
        />
      </section>

      <section className={`${cardCls} mt-6`} aria-labelledby="linked-sellers-title">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h2 id="linked-sellers-title" className="text-xl font-semibold text-foreground-heading">
              Sellers using your code
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              A seller appears here after they apply and link your buyer code.
            </p>
          </div>
        </div>

        {referrals.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
            <UsersRound className="mx-auto h-9 w-9 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground-heading">No linked sellers yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">
              Share your buyer code with an eligible agricultural seller. Their account will appear
              here after they link it.
            </p>
            <Link
              href="/buyer"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
            >
              View my buyer code
            </Link>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {referrals.map((referral) => (
              <ReferralRow key={referral.id} referral={referral} />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-sm text-foreground-muted">
        Referral points are credited when the seller completes eligible sales. The referring
        buyer&apos;s own purchases are excluded from seller referral rewards to reduce self-referral
        abuse.
      </p>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground-heading">{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{detail}</p>
    </div>
  );
}

function ReferralRow({ referral }: { referral: BuyerReferral }) {
  const status =
    referral.status === "active"
      ? "Active"
      : referral.status === "pending"
        ? "Pending first eligible sale"
        : "Paused";

  return (
    <li className="rounded-2xl bg-surface-muted bg-surface-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground-heading">
              {referral.sellerName || "KOMOLA seller"}
            </h3>
            <p className="mt-1 text-xs text-foreground-muted">
              Linked {new Date(referral.createdAt).toLocaleDateString("en-IN")}
              {referral.activatedAt
                ? ` · Activated ${new Date(referral.activatedAt).toLocaleDateString("en-IN")}`
                : ""}
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-foreground-muted">Points earned from this seller</p>
          <p className="mt-1 text-xl font-bold text-status-success">
            {referral.awardedCoins.toLocaleString("en-IN")} coins
          </p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted">Eligible sales through this seller</p>
          <p className="mt-1 text-xl font-bold text-foreground-heading">
            {formatPaise(referral.eligibleSalesMinor)}
          </p>
        </div>
      </div>
    </li>
  );
}
