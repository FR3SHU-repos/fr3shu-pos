"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ScanBarcode,
  ReceiptText,
  Boxes,
  Package,
  Calculator,
  LogOut,
  MoreHorizontal,
  Settings,
  HelpCircle,
  CloudOff,
} from "lucide-react";
// Boxes now labels "Stock"; the old warehouse-style "Inventory & lots" screen is gone.
import { cx } from "@/shared/lib/utils";
import { usePosUser } from "@/shared/context/PosUserContext";
import { sellerDestination } from "@/shared/lib/api/sellerOrgs";
import { Skeleton } from "@/shared/components/ui";

import { OfflineCatalogue } from "@/shared/components/products/OfflineCatalogue";
import { OfflineSalesSyncWorker } from "@/shared/components/pos/OfflineSalesSyncWorker";
import { PwaStatusBar } from "@/shared/components/PwaStatusBar";

const NAV = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/pos", label: "Sell", icon: ScanBarcode },
  { href: "/pos/history", label: "Sales", icon: ReceiptText },
  { href: "/register-sessions", label: "Register", icon: Calculator },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/offline-operations", label: "Offline", icon: CloudOff },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Support", icon: HelpCircle },
];

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const { user, capabilities, organization, loading, logout } = usePosUser();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    if (!organization) {
      if (capabilities?.buyer && !capabilities.seller) {
        if (pathname !== "/buyer") router.replace("/buyer");
      } else if (user.role === "Admin") {
        if (pathname !== "/admin/seller-applications") router.replace("/admin/seller-applications");
      } else if (pathname !== "/seller/onboarding") {
        router.replace("/seller/onboarding");
      }
      return;
    }
    // Approved sellers may navigate to every seller workspace route. The
    // dashboard is only the default landing page; it must not be enforced on
    // POS, history, products, stock, settings, or register-session routes.
    if (organization.approvalStatus === "Approved") return;
    const destination = sellerDestination(organization.approvalStatus);
    if (destination && destination !== pathname) router.replace(destination);
  }, [capabilities, loading, organization, pathname, router, user]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition min-h-11",
              active
                ? "bg-foreground text-white shadow-sm"
                : "text-foreground-body hover:bg-surface-muted",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const mobilePrimaryNav = NAV.slice(0, 4);
  const mobileMoreNav = NAV.slice(4);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface-card p-4 lg:flex">
        <div className="rounded-2xl bg-surface-muted p-3">
          <Brand />
          <p className="mt-2 text-xs text-foreground-muted">Seller workspace</p>
        </div>
        <div className="mt-5 flex-1">{nav}</div>
        {user ? <UserFooter name={user.name} role={user.role} onLogout={handleLogout} /> : <Skeleton className="h-10 w-full" />}
      </aside>

      {/* Application shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <Brand compact />
            <p className="mt-1 pl-12 text-xs text-foreground-muted">Seller POS</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/settings"
              aria-label="Seller settings"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 text-sm font-semibold text-primary"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden min-[390px]:inline">Settings</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden min-[390px]:inline">Exit</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-background px-4 pb-28 pt-4 sm:p-6 sm:pb-28 lg:p-8">
          {user ? <OfflineSalesSyncWorker key={`sales-sync:${user.id}:${user.orgId}:${user.locationId}`} /> : null}
          {user ? <OfflineCatalogue key={`catalogue:${user.id}:${user.orgId}:${user.locationId}`} compact active={pathname !== "/offline-operations"} visible={false} /> : null}
          {user ? <PwaStatusBar /> : null}
          {children}
        </main>

        <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
          {moreOpen ? (
            <div className="mb-3 rounded-3xl border border-border bg-surface-card p-2 shadow-[0_18px_50px_rgba(23,23,23,0.18)]">
              <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">More seller tools</p>
              <div className="grid grid-cols-2 gap-1">
                {mobileMoreNav.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cx(
                        "flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold",
                        active ? "bg-foreground text-white" : "text-foreground-body hover:bg-surface-muted",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
          <nav aria-label="Seller navigation" className="grid grid-cols-5 rounded-3xl border border-border bg-surface-card/95 p-2 shadow-[0_18px_50px_rgba(23,23,23,0.18)] backdrop-blur">
            {mobilePrimaryNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cx(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold",
                    active ? "bg-foreground text-white" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground-body",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label="More seller tools"
              onClick={() => setMoreOpen((open) => !open)}
              className={cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold",
                moreOpen || mobileMoreNav.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
                  ? "bg-foreground text-white"
                  : "text-foreground-muted hover:bg-surface-muted hover:text-foreground-body",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              More
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  async function handleLogout() {
    await logout();
    window.location.replace("/login");
  }
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
      <img src="/komola-logo.png" alt="KOMOLA" className={cx("shrink-0 rounded-lg object-cover", compact ? "h-10 w-10" : "h-8 w-8")} />
      <span className={cx("truncate font-semibold text-foreground-heading", compact ? "text-base" : "text-sm")}>KOMOLA POS</span>
    </Link>
  );
}

function UserFooter({
  name,
  role,
  onLogout,
}: {
  name: string;
  role: string;
  onLogout: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="truncate text-sm font-medium text-foreground-heading">{name}</p>
      <p className="text-xs text-foreground-muted">{role}</p>
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-medium text-foreground-body hover:bg-surface"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
