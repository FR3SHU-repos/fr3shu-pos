"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  Gift,
  LogOut,
  Megaphone,
  QrCode,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { ADMIN_HOME, isPlatformAdmin } from "@/shared/lib/auth/routing";

export function SiteHeader() {
  const { user, capabilities, loading, logout } = usePosUser();
  const pathname = usePathname();
  const accountHref = isPlatformAdmin(user)
    ? ADMIN_HOME
    : user?.orgId
      ? "/dashboard"
      : "/buyer";

  const sellerWorkspaceRoutes = [
    "/dashboard",
    "/pos",
    "/register-sessions",
    "/products",
    "/stock",
    "/offline-operations",
    "/settings",
  ];
  const isSellerWorkspace = sellerWorkspaceRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  // SellerShell owns the POS application chrome on these routes. Keeping the
  // public site header here would render two mobile headers and two exits.
  // BuyerShell owns the chrome on buyer routes (sidebar on desktop, avatar on mobile).
  const isBuyerWorkspace = (pathname === "/buyer" || pathname.startsWith("/buyer/")) && !pathname.startsWith("/buyer/setup");
  if (isSellerWorkspace || isBuyerWorkspace) return null;

  async function handleLogout() {
    await logout();
    window.location.replace("/login");
  }

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border/70 bg-surface backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2"
          aria-label="KOMOLA home"
        >
          <Image
            src="/icons/apple-touch-icon.png"
            alt=""
            width={36}
            height={36}
            sizes="36px"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <span className="truncate text-sm font-semibold text-foreground-heading sm:text-base">
            KOMOLA
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-1 sm:gap-2"
        >
          {capabilities?.buyer ? (
            <>
              <Link href="/buyer" className={`${navLinkClass} !hidden xl:!inline-flex`}>
                <Gift className="h-4 w-4" aria-hidden="true" />
                Rewards
              </Link>
              <Link href="/buyer/campaigns" className={`${navLinkClass} !hidden xl:!inline-flex`}>
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                Offers
              </Link>
              <Link href="/buyer/wallet" className={`${navLinkClass} !hidden xl:!inline-flex`}>
                <WalletCards className="h-4 w-4" aria-hidden="true" />
                Wallet
              </Link>
              <Link href="/buyer/referrals" className={`${navLinkClass} !hidden xl:!inline-flex`}>
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                Referrals
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
              Seller settings
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
                className="hidden min-h-10 max-w-40 items-center truncate rounded-lg bg-surface-card px-3 py-2.5 text-sm font-semibold text-foreground-heading sm:inline-flex"
                title={user.name || user.email}
              >
                <CircleUserRound className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
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

export function SiteMobileNavigation() {
  const { capabilities, loading } = usePosUser();
  const pathname = usePathname();

  if (loading || !capabilities?.buyer || (pathname !== "/buyer" && !pathname.startsWith("/buyer/"))) {
    return null;
  }

  const items = [
    { href: "/buyer", label: "Rewards", icon: Gift },
    { href: "/buyer/campaigns", label: "Offers", icon: Megaphone },
    { href: "/buyer/wallet", label: "Wallet", icon: WalletCards },
    { href: "/buyer/referrals", label: "Referrals", icon: UsersRound },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <nav aria-label="Buyer navigation" className="safe-area-bottom grid grid-cols-4 bg-surface-card/95 px-2 pt-2 backdrop-blur">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/buyer" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${active ? "text-primary" : "text-foreground-muted hover:text-foreground-heading"} flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-border bg-surface-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-1 px-4 py-5 text-center text-xs text-foreground-muted sm:flex-row sm:px-6 sm:text-left">
        <span>© {new Date().getFullYear()} KOMOLA</span>
        <span className="flex items-center gap-3"><span>Visakhapatnam, India</span><Link href="/support" className="font-semibold text-primary hover:underline">Support</Link><Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy</Link><Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link><Link href="/privacy/requests" className="font-semibold text-primary hover:underline">Privacy requests</Link></span>
      </div>
    </footer>
  );
}

const navLinkClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-medium text-foreground-body transition hover:bg-surface-card hover:text-foreground-heading sm:px-3 sm:text-sm";
