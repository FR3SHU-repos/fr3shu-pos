"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AvatarStudio, type AvatarStudioState } from "@/shared/components/avatar/AvatarStudio";
import { Skeleton } from "@/shared/components/ui";
import { identityApi } from "@/shared/lib/api";
import { normaliseAvatar } from "@/shared/lib/avatar/avatar";

export default function BuyerAvatarPage() {
  const [initial, setInitial] = useState<AvatarStudioState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void identityApi.avatar().then((result) => {
      if (!result.success || !result.data) {
        setError(
          result.status === 404
            ? "Avatars aren't available on this server yet. Update the API and try again."
            : result.message || "Could not load your avatar",
        );
        return;
      }
      setInitial({
        avatar: normaliseAvatar(result.data.avatar),
        owned: result.data.owned ?? [],
        availableCoins: result.data.availableCoins ?? 0,
      });
    });
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-background p-4 pb-44 sm:p-8 sm:pb-44 lg:pb-8">
      <header className="mb-5">
        <Link
          href="/buyer"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-foreground-muted hover:text-foreground-heading"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Rewards
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground-heading">
          Dress up your Komo
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Try anything on for free. Spend reward points to unlock items — you keep them forever.
        </p>
      </header>
      {error ? (
        <p role="alert" className="rounded-2xl bg-status-warning-surface p-4 text-status-warning">
          {error}
        </p>
      ) : initial ? (
        <AvatarStudio
          initial={initial}
          onSave={async (avatar) => {
            const result = await identityApi.saveAvatar(avatar);
            return {
              ok: result.success,
              message: result.message,
              state: result.data
                ? {
                    avatar: normaliseAvatar(result.data.avatar),
                    owned: result.data.owned ?? [],
                    availableCoins: result.data.availableCoins ?? 0,
                  }
                : undefined,
            };
          }}
          onUnlock={async (items, avatar) => {
            const result = await identityApi.unlockAvatar(items, avatar);
            return {
              ok: result.success,
              message:
                result.code === "insufficient_coins"
                  ? "You don't have enough reward points for these items."
                  : result.message,
              state: result.data
                ? {
                    avatar: normaliseAvatar(result.data.avatar),
                    owned: result.data.owned ?? [],
                    availableCoins: result.data.availableCoins ?? 0,
                  }
                : undefined,
            };
          }}
        />
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </main>
  );
}
