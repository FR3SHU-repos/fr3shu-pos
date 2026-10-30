"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "@/shared/lib/api/client";

export interface UseApiOptions {
  /** Skip fetching while false (e.g. waiting for the user context). Default true. */
  enabled?: boolean;
  /** Wait this long after the inputs change before fetching (search boxes). Default 0. */
  debounceMs?: number;
  /** Keep the previous payload visible while a refetch runs (lists/filters). Default true; use false for detail pages keyed by id. */
  keepData?: boolean;
}

export interface UseApiState<T> {
  /** Latest successful payload. Kept while a refetch is in flight. */
  data: T | null;
  /** Message from the latest failed request, or null. */
  error: string | null;
  /** True while a request is in flight, including refetches. */
  loading: boolean;
  /** Re-run the request now; resolves once it settles. */
  refetch: () => Promise<void>;
  /** Replace the cached payload locally, e.g. after a mutation returns the new record. */
  mutate: (next: T | null | ((current: T | null) => T | null)) => void;
}

/**
 * Fetch-on-mount / fetch-on-change for the typed API client.
 *
 * - Aborts the previous request and ignores late responses, so changing a
 *   filter can never show results for an older one.
 * - Cleans up on unmount; no setState after unmount.
 * - `fetcher` may use the AbortSignal (pass it to `signal` in list calls) but
 *   stale responses are discarded even if it does not.
 *
 * `deps` are the values the request depends on, like useEffect deps. The
 * fetcher itself is read through a ref and need not be memoised.
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<ApiResult<T>>,
  deps: readonly unknown[],
  { enabled = true, debounceMs = 0, keepData = true }: UseApiOptions = {},
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const fetcherRef = useRef(fetcher);
  const runRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) {
      runRef.current = null;
      return;
    }
    const ctrl = new AbortController();
    let current = true;
    const run = async () => {
      setLoading(true);
      if (!keepData) setData(null);
      setError(null);
      try {
        const res = await fetcherRef.current(ctrl.signal);
        if (!current) return;
        if (res.success && res.data !== null) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.message || "Something went wrong");
        }
      } catch (err) {
        if (!current || ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      if (current) setLoading(false);
    };
    runRef.current = run;
    const timer = setTimeout(() => void run(), debounceMs);
    return () => {
      current = false;
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, keepData, ...deps]);

  const refetch = useCallback(async () => {
    await runRef.current?.();
  }, []);

  return { data, error, loading, refetch, mutate: setData };
}
