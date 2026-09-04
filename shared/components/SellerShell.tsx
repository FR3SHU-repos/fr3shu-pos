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
} from "lucide-react";
import { cx } from "@/shared/lib/utils";
import { usePosUser } from "@/shared/context/PosUserContext";
import { Skeleton } from "@/shared/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Point of Sale", icon: ScanBarcode },
  { href: "/pos/history", label: "Sales history", icon: ReceiptText },
  { href: "/register-sessions", label: "Register sessions", icon: Calculator },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory/lots", label: "Inventory & lots", icon: Boxes },
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
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen p-6">
        <Skeleton className="mb-4 h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

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
        <UserFooter name={user.name} role={user.role} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface-card px-4 py-3 lg:hidden">
          <Brand />
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
              <UserFooter name={user.name} role={user.role} onLogout={handleLogout} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <span className="text-sm font-bold">F3</span>
      </span>
      <span className="text-sm font-semibold text-foreground-heading">FR3SHU POS</span>
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
