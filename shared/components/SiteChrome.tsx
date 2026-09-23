"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, QrCode } from "lucide-react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";
import { sellerOrgsApi } from "@/shared/lib/api";

export function SiteHeader() {
  const { user, capabilities, loading, logout } = usePosUser();
  const [hasUpiId, setHasUpiId] = useState<boolean | null>(null);
  const accountHref = isPlatformAdmin(user)
    ? ADMIN_HOME
    : user?.orgId
      ? "/dashboard"
      : "/buyer";

  const loadPaymentSettings = useCallback(() => {
    if (!capabilities?.seller || !user?.orgId) return;
    void sellerOrgsApi.getMyOrganization().then((result) => {
      if (result.success && result.data)
        setHasUpiId(Boolean(result.data.organization.upiId));
    });
  }, [capabilities?.seller, user?.orgId]);

  useEffect(() => {
    loadPaymentSettings();
    window.addEventListener(
      "komola:payment-settings-changed",
      loadPaymentSettings,
    );
    return () =>
      window.removeEventListener(
        "komola:payment-settings-changed",
        loadPaymentSettings,
      );
  }, [loadPaymentSettings]);

  async function handleLogout() {
    await logout();
    window.location.replace("/login");
  }

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-surface-card/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2"
          aria-label="KOMOLA home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/komola-logo.png"
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <span className="truncate text-sm font-semibold text-foreground-heading sm:text-base">
            KOMOLA <span className="hidden sm:inline">Organic POS</span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-1 sm:gap-2"
        >
          {capabilities?.buyer ? (
            <>
              <Link href="/buyer" className={navLinkClass}>
                Rewards
              </Link>
              <Link href="/buyer/campaigns" className={navLinkClass}>
                Offers
              </Link>
              <Link href="/buyer/wallet" className={navLinkClass}>
                Wallet
              </Link>
            </>
          ) : null}
          {capabilities?.seller || isPlatformAdmin(user) ? (
            <Link href="/dashboard" className={navLinkClass}>
              Seller POS
            </Link>
          ) : null}
          {capabilities?.seller && user?.orgId ? (
            <Link
              href="/settings"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10 sm:px-3 sm:text-sm"
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              {hasUpiId ? "Edit UPI ID" : "Add UPI ID"}
            </Link>
          ) : null}
          {loading ? (
            <span
              className="h-10 w-16 animate-pulse rounded-lg bg-border sm:w-24"
              aria-label="Checking sign-in status"
            />
          ) : user ? (
            <>
              <Link
                href={accountHref}
                className="hidden min-h-10 max-w-40 items-center truncate rounded-lg bg-surface px-3 py-2.5 text-sm font-semibold text-foreground-heading sm:inline-flex"
                title={user.name || user.email}
              >
                {user.name || "My account"}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover sm:px-4 sm:text-sm"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sm:hidden">Exit</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="min-h-10 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover sm:px-4 sm:text-sm"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-border bg-surface-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-1 px-4 py-5 text-center text-xs text-foreground-muted sm:flex-row sm:px-6 sm:text-left">
        <span>© {new Date().getFullYear()} KOMOLA Organic POS</span>
        <span>Visakhapatnam, India</span>
      </div>
    </footer>
  );
}

const navLinkClass =
  "min-h-10 rounded-lg px-2 py-2.5 text-xs font-medium text-foreground-body transition hover:bg-surface hover:text-foreground-heading sm:px-3 sm:text-sm";
