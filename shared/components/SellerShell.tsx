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
} from "lucide-react";
// Boxes now labels "Stock"; the old warehouse-style "Inventory & lots" screen is gone.
import { cx } from "@/shared/lib/utils";
import { usePosUser } from "@/shared/context/PosUserContext";
import { getMyOrganization, sellerDestination } from "@/shared/lib/api/sellerOrgs";
import { Skeleton } from "@/shared/components/ui";

import { OfflineCatalogue } from "@/shared/components/products/OfflineCatalogue";
import { OfflineSalesPanel } from "@/shared/components/pos/OfflineSalesPanel";
import { OfflineSalesSyncWorker } from "@/shared/components/pos/OfflineSalesSyncWorker";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Point of Sale", icon: ScanBarcode },
  { href: "/pos/history", label: "Sales history", icon: ReceiptText },
  { href: "/register-sessions", label: "Register sessions", icon: Calculator },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/settings", label: "Payment settings", icon: Settings },
];

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = usePosUser();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void getMyOrganization().then((result) => {
      if (!active || result.status === 0) return;
      if (result.status === 404) router.replace("/seller/onboarding");
      else {
        const destination = sellerDestination(result.data?.approvalStatus);
        if (destination && destination !== pathname) router.replace(destination);
      }
    });
    return () => { active = false; };
  }, [loading, pathname, router, user]);

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
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition min-h-11",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground-body hover:bg-surface",
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
        <Brand />
        <div className="mt-6 flex-1">{nav}</div>
        {user ? <UserFooter name={user.name} role={user.role} onLogout={handleLogout} /> : <Skeleton className="h-10 w-full" />}
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface-card px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold text-foreground-heading">Seller workspace</span>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 text-foreground-body hover:bg-surface"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {mobileOpen ? (
          <div className="border-b border-border bg-surface-card p-4 lg:hidden">
            {nav}
            <div className="mt-4">
              {user ? <UserFooter name={user.name} role={user.role} onLogout={handleLogout} /> : <Skeleton className="h-10 w-full" />}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {user ? <OfflineSalesSyncWorker key={`sales-sync:${user.id}:${user.orgId}:${user.locationId}`} /> : null}
          {user ? <OfflineCatalogue key={`catalogue:${user.id}:${user.orgId}:${user.locationId}`} /> : null}
          {user ? <OfflineSalesPanel key={`sales:${user.id}:${user.orgId}:${user.locationId}`} /> : null}
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
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <span className="text-sm font-bold">F3</span>
      </span>
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
