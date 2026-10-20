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
  Menu,
  X,
  Settings,
  HelpCircle,
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
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Support", icon: HelpCircle },
];

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const { user, capabilities, organization, loading, logout } = usePosUser();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setMobileOpen(false);
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

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface-card px-4 py-3 lg:hidden">
          <Brand />
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="min-h-11 min-w-11 rounded-xl p-2 text-foreground-body hover:bg-surface-muted"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {mobileOpen ? (
          <div className="border-b border-border bg-surface-card p-4 shadow-sm lg:hidden">
            {nav}
            <div className="mt-4">
              {user ? <UserFooter name={user.name} role={user.role} onLogout={handleLogout} /> : <Skeleton className="h-10 w-full" />}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 bg-background p-4 sm:p-6 lg:p-8">
          {user ? <OfflineSalesSyncWorker key={`sales-sync:${user.id}:${user.orgId}:${user.locationId}`} /> : null}
          {user ? <OfflineCatalogue key={`catalogue:${user.id}:${user.orgId}:${user.locationId}`} compact /> : null}
          {user ? <PwaStatusBar /> : null}
          {children}
        </main>
      </div>
    </div>
  );

  async function handleLogout() {
    await logout();
    window.location.replace("/login");
  }
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <img src="/komola-logo.png" alt="KOMOLA" className="h-8 w-8 rounded-lg object-cover" />
      <span className="text-sm font-semibold text-foreground-heading">KOMOLA POS</span>
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
