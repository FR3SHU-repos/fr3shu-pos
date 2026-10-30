"use client";

import Image from "next/image";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, HelpCircle, LogOut, Megaphone, UsersRound, WalletCards } from "lucide-react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { cx } from "@/shared/lib/utils";

export const BUYER_NAV = [
  { href: "/buyer", label: "Rewards", icon: Gift },
  { href: "/buyer/campaigns", label: "Offers", icon: Megaphone },
  { href: "/buyer/wallet", label: "Wallet", icon: WalletCards },
  { href: "/buyer/referrals", label: "Referrals", icon: UsersRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/buyer" && pathname.startsWith(`${href}/`));
}

/** Buyer workspace chrome: left sidebar on desktop; the tab bar lives in SiteMobileNavigation. */
export default function BuyerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = usePosUser();
  // Setup runs before the buyer account is usable, so it keeps a plain page.
  if (pathname.startsWith("/buyer/setup")) return <>{children}</>;

  const initials = (user?.name || "B")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-surface-card p-4 lg:flex">
        <Link href="/buyer" className="flex items-center gap-3 p-2">
          <Image
            src="/komola-logo.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-cover"
          />
          <span className="leading-tight">
            <span className="block text-base font-bold text-foreground-heading">KOMOLA</span>
            <span className="block text-xs text-foreground-muted">Buyer rewards</span>
          </span>
        </Link>
        <nav aria-label="Buyer navigation" className="mt-6 flex flex-col gap-1">
          {BUYER_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
                  active
                    ? "bg-surface-muted text-foreground-heading"
                    : "text-foreground-muted hover:bg-surface-muted/60 hover:text-foreground-heading",
                )}
              >
                <Icon className={cx("h-5 w-5", active && "text-primary")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <Link
          href="/support"
          className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-foreground-muted hover:text-foreground-heading"
        >
          <HelpCircle className="h-5 w-5" />
          Support
        </Link>
        {user ? (
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-foreground-heading">
                {user.name || "My account"}
              </span>
              <span className="block truncate text-xs text-foreground-muted">{user.email}</span>
            </span>
            <button
              type="button"
              aria-label="Sign out"
              onClick={async () => {
                await logout();
                window.location.replace("/login");
              }}
              className="grid h-10 w-10 place-items-center rounded-full text-foreground-muted hover:text-foreground-heading"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
