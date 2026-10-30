"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ghostBtnCls, primaryBtnCls, Skeleton } from "@/shared/components/ui";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Where "Go to ..." leads for this area. */
  homeHref: string;
  homeLabel: string;
}

/** Recovery screen for a render error inside a route segment. */
export function RouteError({ error, reset, homeHref, homeLabel }: RouteErrorProps) {
  useEffect(() => {
    // Surfaces in the browser console and any attached error reporter.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl bg-surface-card px-6 py-14 text-center">
      <p className="text-lg font-bold text-foreground-heading">Something went wrong</p>
      <p className="mt-2 text-sm text-foreground-muted">
        This screen hit an unexpected problem. Your saved data is safe. Try again, or go back to {homeLabel}.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-foreground-muted">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={primaryBtnCls}>
          Try again
        </button>
        <Link href={homeHref} className={ghostBtnCls}>
          Go to {homeLabel}
        </Link>
      </div>
    </div>
  );
}

/** Page not found inside a route segment. */
export function RouteNotFound({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl bg-surface-card px-6 py-14 text-center">
      <p className="text-lg font-bold text-foreground-heading">Page not found</p>
      <p className="mt-2 text-sm text-foreground-muted">The page you opened does not exist or has moved.</p>
      <Link href={homeHref} className={`${primaryBtnCls} mt-6`}>
        Go to {homeLabel}
      </Link>
    </div>
  );
}

/** Generic route-level loading placeholder. */
export function RouteLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
