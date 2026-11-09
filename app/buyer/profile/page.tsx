"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Pencil } from "lucide-react";
import { BuyerCodeQr } from "@/shared/components/buyer/BuyerCodeQr";
import { KomoAvatar } from "@/shared/components/avatar/KomoAvatar";
import { Skeleton, cardCls } from "@/shared/components/ui";
import { identityApi, rewardsApi } from "@/shared/lib/api";
import type { DiscoveryCode, PersonProfile } from "@/shared/lib/api/identity";
import { normaliseAvatar } from "@/shared/lib/avatar/avatar";
import type { BuyerAvatar } from "@/shared/lib/avatar/avatar";

export default function BuyerProfilePage() {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [avatar, setAvatar] = useState<BuyerAvatar | null>(null);
  const [code, setCode] = useState<DiscoveryCode | null>(null);
  const [coins, setCoins] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([identityApi.profile(), identityApi.discoveryCode(), identityApi.avatar(), rewardsApi.summary()]).then(
      ([person, discovery, avatarResult, rewards]) => {
        if (!person.success || !person.data) {
          setError(person.message || "Could not load your buyer profile");
          return;
        }
        setProfile(person.data);
        if (discovery.success) setCode(discovery.data);
        if (avatarResult.success && avatarResult.data) setAvatar(normaliseAvatar(avatarResult.data.avatar));
        if (rewards.success && rewards.data) setCoins(rewards.data.lifetimeEarnedCoins);
      },
    );
  }, []);

  if (!profile && !error) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl space-y-4 bg-background p-4 pb-32 sm:p-8">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-56 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background p-4 pb-32 sm:p-8">
      <header className="mb-5">
        <Link
          href="/buyer"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-foreground-muted hover:text-foreground-heading"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Rewards
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-foreground-heading">
          My profile
        </h1>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl bg-status-danger-surface p-4 text-status-danger">
          {error}
        </p>
      ) : profile ? (
        <div className="space-y-4">
          <section className={`${cardCls} flex items-center gap-4`} aria-label="Buyer details">
            <KomoAvatar
              avatar={avatar}
              view="head"
              className="h-24 w-24 shrink-0 rounded-3xl"
              priority
            />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-foreground-heading">{profile.displayName}</p>
              <p className="mt-1 text-sm text-foreground-muted">
                {profile.locationName || profile.locationCode || "Buyer account"}
              </p>
              <p className="mt-1 text-sm text-foreground-muted">{coins} coins earned</p>
            </div>
            <Link
              href="/buyer/avatar"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm font-semibold text-foreground-heading"
            >
              <Pencil className="h-4 w-4" />
              Edit avatar
            </Link>
          </section>

          <section className={`${cardCls} text-center`} aria-labelledby="profile-code-title">
            <h2 id="profile-code-title" className="text-xl font-semibold text-foreground-heading">
              Show your buyer code
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Ask the seller to scan this QR code while recording your purchase.
            </p>
            {code ? (
              <div className="mt-5 flex justify-center">
                <BuyerCodeQr code={code.code} />
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-status-warning-surface p-4 text-sm text-status-warning">
                Your buyer code is not available yet. Complete your buyer details first.
              </p>
            )}
          </section>

          <Link
            href="/buyer/setup"
            className="block rounded-3xl bg-surface-card p-5 text-sm font-semibold text-primary hover:underline"
          >
            Edit profile details
          </Link>
        </div>
      ) : null}
    </main>
  );
}
