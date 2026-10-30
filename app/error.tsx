"use client";

import { RouteError } from "@/shared/components/RouteBoundary";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <RouteError {...props} homeHref="/" homeLabel="the home page" />
    </main>
  );
}
