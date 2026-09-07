"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ScanLine, Sprout, WifiOff } from "lucide-react";
import { cx } from "@/shared/lib/utils";
import { ghostBtnCls, primaryBtnCls } from "@/shared/components/ui";

type Audience = "seller" | "buyer";

/**
 * Public landing page shown at `/`. Minimal by intent: what KOMOLA is, then a
 * clear way in. Sellers sign in / register here; the buyer path (receipt and
 * reward lookup) is not built yet and is shown as coming soon.
 */
export function Landing({ signedIn }: { signedIn: boolean }) {
  const [audience, setAudience] = useState<Audience>("seller");

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-surface">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-4">
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/komola-logo.png"
            alt=""
            className="h-9 w-9 rounded-lg object-contain"
          />
          <span className="text-sm font-semibold text-foreground-heading">
            KOMOLA Organic POS
          </span>
        </span>
        <Link
          href={signedIn ? "/dashboard" : "/login"}
          className="text-sm font-medium text-primary hover:underline"
        >
          {signedIn ? "Go to dashboard" : "Sign in"}
        </Link>
      </header>

      <section className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 text-center sm:pt-14">
        <h1 className="text-2xl font-semibold text-foreground-heading sm:text-3xl">
          Simple point of sale for organic sellers
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-foreground-body sm:text-base">
          Sell by weight or by piece, track every harvest batch, and keep selling
          even when the internet drops. Buyers get a clear receipt and reward
          points.
        </p>

        <div
          role="tablist"
          aria-label="Choose who you are"
          className="mx-auto mt-8 inline-flex rounded-xl border border-border bg-surface-card p-1"
        >
          <TabButton
            id="tab-seller"
            selected={audience === "seller"}
            onClick={() => setAudience("seller")}
          >
            For sellers
          </TabButton>
          <TabButton
            id="tab-buyer"
            selected={audience === "buyer"}
            onClick={() => setAudience("buyer")}
          >
            For buyers
          </TabButton>
        </div>

        <div
          role="tabpanel"
          aria-live="polite"
          className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-surface-card p-6"
        >
          {audience === "seller" ? (
            <>
              <p className="text-sm text-foreground-body">
                For farmers, FPOs and organic brands running a stall or a shop.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {signedIn ? (
                  <Link href="/dashboard" className={primaryBtnCls}>
                    Go to your dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className={primaryBtnCls}>
                      Sign in
                    </Link>
                    <Link href="/register" className={ghostBtnCls}>
                      Create seller account
                    </Link>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground-body">
                Scan the QR code on your KOMOLA receipt to open it again or to
                check your reward points.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <ComingSoon>Find a receipt</ComingSoon>
                <ComingSoon>Check reward points</ComingSoon>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-4 pb-16 sm:grid-cols-3">
        <Feature
          icon={<ScanLine className="h-5 w-5" />}
          title="Fast checkout"
          text="Scan or tap, weigh, take cash or UPI, and print a receipt."
        />
        <Feature
          icon={<WifiOff className="h-5 w-5" />}
          title="Works offline"
          text="Sales are saved on the device and sync when you reconnect."
        />
        <Feature
          icon={<Sprout className="h-5 w-5" />}
          title="Organic lots"
          text="Track every harvest batch and its certification."
        />
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-foreground-muted">
        KOMOLA Organic POS · Visakhapatnam
      </footer>
    </main>
  );
}

function TabButton({
  id,
  selected,
  onClick,
  children,
}: {
  id: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      onClick={onClick}
      className={cx(
        "min-h-11 rounded-lg px-4 text-sm font-medium transition",
        selected
          ? "bg-primary text-primary-foreground"
          : "text-foreground-body hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-disabled="true"
      title="Coming soon"
      className={cx(ghostBtnCls, "cursor-not-allowed opacity-70")}
    >
      {children}
      <span className="rounded-full bg-border px-2 py-0.5 text-xs text-foreground-muted">
        Coming soon
      </span>
    </span>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-5 text-left">
      <div className="flex items-center gap-2 text-primary">{icon}</div>
      <p className="mt-2 text-sm font-semibold text-foreground-heading">{title}</p>
      <p className="mt-1 text-sm text-foreground-muted">{text}</p>
    </div>
  );
}
