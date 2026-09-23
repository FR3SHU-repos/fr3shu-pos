"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Gift,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { cx } from "@/shared/lib/utils";
import { ghostBtnCls, primaryBtnCls } from "@/shared/components/ui";
import { Komo } from "@/shared/components/mascot";

type Audience = "seller" | "buyer";

/** Public landing page for the KOMOLA POS and buyer rewards experience. */
export function Landing({ signedIn }: { signedIn: boolean }) {
  const [audience, setAudience] = useState<Audience>("seller");
  const isSeller = audience === "seller";
  const content = isSeller
    ? {
        eyebrow: "KOMOLA FOR AGRI SELLERS",
        title: "Make every sale feel like a win.",
        description:
          "A friendly POS for weighing, selling, and rewarding the people who choose your products.",
        action: "produce" as const,
        primaryLabel: signedIn ? "Open seller dashboard" : "Get started as a seller",
        primaryHref: signedIn ? "/dashboard" : "/register/seller",
        secondaryLabel: "I’m a buyer",
        badge: "Fast checkout",
        badgeDetail: "Sell by weight or piece",
      }
    : {
        eyebrow: "KOMOLA FOR AGRI BUYERS",
        title: "Good purchases deserve a little extra.",
        description:
          "Keep your receipts, collect points, and discover rewards from the agri sellers around you.",
        action: "reward" as const,
        primaryLabel: signedIn ? "Open buyer wallet" : "Get started as a buyer",
        primaryHref: signedIn ? "/buyer/wallet" : "/register/buyer",
        secondaryLabel: "I’m a seller",
        badge: "Rewards built in",
        badgeDetail: "Points on eligible purchases",
      };

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-hidden bg-surface">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10 lg:px-8 lg:pb-16 lg:pt-14">
        <div className="relative overflow-hidden rounded-[2rem] border border-secondary/30 bg-secondary-subtle p-6 text-foreground-heading shadow-[0_18px_50px_rgba(90,159,58,0.18)] sm:p-10 lg:min-h-[34rem]">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              KOMO is here
            </span>
          </div>

          <div className="relative flex min-h-[21rem] items-center justify-center sm:min-h-[25rem]">
            <Komo action={content.action} size="hero" alt="Komo mascot" priority className="z-10 scale-110 drop-shadow-[0_18px_8px_rgba(123,36,12,0.18)] sm:scale-125" />
            <div className="absolute left-0 top-12 z-20 rounded-2xl bg-white px-4 py-3 text-left text-foreground-heading shadow-lg sm:left-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{content.badge}</p>
              <p className="mt-1 text-sm font-bold">{content.badgeDetail}</p>
            </div>
            <div className="absolute bottom-6 right-0 z-20 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-left text-foreground-heading shadow-lg sm:right-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-primary">
                {isSeller ? <ReceiptText className="h-5 w-5" aria-hidden="true" /> : <Gift className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground-muted">{isSeller ? "Every sale" : "Every reward"}</span>
                <span className="block text-sm font-bold">Counts with KOMOLA</span>
              </span>
            </div>
          </div>

          <p className="max-w-sm text-lg font-semibold leading-snug text-foreground-heading sm:text-xl">
            {isSeller ? "A brighter way to run the counter." : "A brighter way to shop local agri products."}
          </p>
        </div>

        <div className="flex flex-col justify-center py-2 lg:py-6">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">{content.eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-4xl font-black leading-[1.04] tracking-tight text-foreground-heading sm:text-5xl lg:text-6xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-foreground-body">{content.description}</p>

          <div role="tablist" aria-label="Choose your KOMOLA experience" className="mt-8 grid max-w-lg grid-cols-2 rounded-2xl border border-border bg-surface-card p-1.5 shadow-sm">
            <AudienceTab selected={isSeller} onClick={() => setAudience("seller")} icon={<Store className="h-5 w-5" aria-hidden="true" />}>
              Agri seller
            </AudienceTab>
            <AudienceTab selected={!isSeller} onClick={() => setAudience("buyer")} icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}>
              Agri buyer
            </AudienceTab>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={content.primaryHref} className={`${primaryBtnCls} min-h-14 px-6 text-base`}>
              {content.primaryLabel}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => setAudience(isSeller ? "buyer" : "seller")} className={`${ghostBtnCls} min-h-14 px-6 text-base`}>
              {content.secondaryLabel}
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-foreground-muted">
            <span className="inline-flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-secondary" aria-hidden="true" />Clear receipts</span>
            <span className="inline-flex items-center gap-2"><Gift className="h-5 w-5 text-secondary" aria-hidden="true" />Earn Komola Coins</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works-title" className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Simple by design</p>
            <h2 id="how-it-works-title" className="mt-2 text-2xl font-black text-foreground-heading sm:text-3xl">One happy loop</h2>
          </div>
          <p className="hidden max-w-xs text-right text-sm text-foreground-muted sm:block">Sell well. Buy confidently. Keep the good feeling going.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Step number="01" icon={<ScanLine className="h-5 w-5" aria-hidden="true" />} title="Sell or shop" text="Complete a clear agri purchase with a KOMOLA seller." />
          <Step number="02" icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />} title="Keep the receipt" text="Every purchase stays connected to the right account." />
          <Step number="03" icon={<Gift className="h-5 w-5" aria-hidden="true" />} title="Get rewarded" text="Earn points and discover offers made for your area." />
        </div>
      </section>
    </main>
  );
}

function AudienceTab({ selected, onClick, icon, children }: { selected: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onClick} className={cx("inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition sm:text-base", selected ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground-body hover:bg-surface")}>
      {icon}
      {children}
    </button>
  );
}

function Step({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-surface-card p-5 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">{icon}</span>
        <span className="text-sm font-black tracking-widest text-border">{number}</span>
      </div>
      <h3 className="mt-5 text-lg font-bold text-foreground-heading">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{text}</p>
    </div>
  );
}
