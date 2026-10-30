"use client";

import Image from "next/image";
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
  Sun,
  Moon,
  ChevronRight,
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
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/pos", label: "Sell", icon: ScanBarcode },
  { href: "/pos/history", label: "Sales", icon: ReceiptText },
  { href: "/register-sessions", label: "Register", icon: Calculator },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/offline-operations", label: "Offline", icon: CloudOff },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Support", icon: HelpCircle },
];

function matchActive(pathname: string, href: string) {
  // Longest matching nav entry wins so /pos/history highlights Sales, not Sell.
  const hit = NAV.filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return hit?.href === href;
}

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const { user, capabilities, organization, loading, logout } = usePosUser();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("komola-theme", next);
    } catch {
      /* storage unavailable: theme applies for this visit only */
    }
  }

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
        const active = matchActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition min-h-12",
              active
                ? "bg-surface-muted text-foreground-heading"
                : "text-foreground-muted hover:bg-surface-muted/60 hover:text-foreground-heading",
            )}
          >
            <Icon className={cx("h-5 w-5 shrink-0", active && "text-primary")} />
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
      <aside className="hidden w-64 shrink-0 flex-col bg-surface-card p-4 lg:flex">
        <div className="p-2">
          <Brand />
          <p className="mt-2 text-xs text-foreground-muted">Seller workspace</p>
        </div>
        <div className="mt-5 flex-1">{nav}</div>
        {user ? <UserFooter name={user.name} role={user.role} onLogout={handleLogout} /> : <Skeleton className="h-10 w-full" />}
      </aside>

      {/* Application shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <Brand compact />

          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="grid h-11 w-11 place-items-center rounded-full bg-surface-muted text-foreground-body"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>

        <main className="min-w-0 flex-1 bg-background px-4 pb-32 pt-4 sm:p-6 sm:pb-32 lg:p-8 lg:pb-8">
          {user ? <OfflineSalesSyncWorker key={`sales-sync:${user.id}:${user.orgId}:${user.locationId}`} /> : null}
          {user ? <OfflineCatalogue key={`catalogue:${user.id}:${user.orgId}:${user.locationId}`} compact active={pathname !== "/offline-operations"} visible={false} /> : null}
          {user ? <PwaStatusBar /> : null}
          {children}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
          {moreOpen ? (
            <div className="mx-3 mb-2 rounded-3xl bg-surface-raised p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
              {mobileMoreNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-foreground-heading hover:bg-surface-muted"
                >
                  <Icon className="h-5 w-5 shrink-0 text-foreground-muted" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="h-4 w-4 text-foreground-muted" />
                </Link>
              ))}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-foreground-heading hover:bg-surface-muted"
              >
                {theme === "dark" ? <Sun className="h-5 w-5 text-foreground-muted" /> : <Moon className="h-5 w-5 text-foreground-muted" />}
                <span className="flex-1 text-left">{theme === "dark" ? "Light theme" : "Dark theme"}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-status-danger hover:bg-surface-muted"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">Sign out</span>
              </button>
            </div>
          ) : null}
          <nav aria-label="Seller navigation" className="safe-area-bottom grid grid-cols-5 bg-surface-card/95 px-2 pt-2 backdrop-blur">
            {mobilePrimaryNav.map(({ href, label, icon: Icon }) => {
              const active = matchActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold",
                    active ? "text-primary" : "text-foreground-muted hover:text-foreground-heading",
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
                moreOpen || mobileMoreNav.some(({ href }) => matchActive(pathname, href))
                  ? "text-primary"
                  : "text-foreground-muted hover:text-foreground-heading",
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
      <Image src="/komola-logo.png" alt="KOMOLA" width={40} height={40} className={cx("shrink-0 rounded-lg object-cover", compact ? "h-10 w-10" : "h-8 w-8")} />
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
    <div className="rounded-2xl bg-surface-muted p-3">
      <p className="truncate text-sm font-medium text-foreground-heading">{name}</p>
      <p className="text-xs text-foreground-muted">{role}</p>
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-surface-card px-3 py-2 text-xs font-semibold text-foreground-body hover:bg-tertiary"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
