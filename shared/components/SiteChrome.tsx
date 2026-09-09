import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-surface-card/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="KOMOLA home">
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

        <nav aria-label="Primary navigation" className="flex items-center gap-1 sm:gap-2">
          <Link href="/buyer" className={navLinkClass}>
            Rewards
          </Link>
          <Link href="/dashboard" className={navLinkClass}>
            Seller POS
          </Link>
          <Link
            href="/login"
            className="min-h-10 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover sm:px-4 sm:text-sm"
          >
            Sign in
          </Link>
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
