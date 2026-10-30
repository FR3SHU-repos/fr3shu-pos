"use client";

import { RouteError } from "@/shared/components/RouteBoundary";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} homeHref="/dashboard" homeLabel="Home" />;
}
