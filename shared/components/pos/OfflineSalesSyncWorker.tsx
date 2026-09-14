"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { usePosUser } from "@/shared/context/PosUserContext";
import { salesApi } from "@/shared/lib/api";
import type { OfflineScope } from "@/shared/lib/offline/sales";

const SYNC_INTERVAL_MS = 30_000;
const LAST_SYNC_KEY_PREFIX = "komola:offline-sales:last-sync:";
export const OFFLINE_SALES_SYNC_EVENT = "komola:offline-sales-sync";

export interface OfflineSalesSyncDetail {
  attempted: number;
  synced: number;
  blocked: number;
  authRequired: boolean;
  unavailable?: boolean;
  message?: string;
  blockedMessages?: string[];
  at: string;
  automatic: boolean;
}

function scopeKey(scope: OfflineScope): string {
  return JSON.stringify([scope.userId, scope.orgId, scope.locationId]);
}

export function offlineSalesLastSyncKey(scope: OfflineScope): string {
  return `${LAST_SYNC_KEY_PREFIX}${scopeKey(scope)}`;
}

export function OfflineSalesSyncWorker() {
  const { user } = usePosUser();
  const syncingRef = useRef(false);

  const scope = useMemo<OfflineScope | null>(() => {
    if (!user) return null;
    return { userId: user.id, orgId: user.orgId, locationId: user.locationId };
  }, [user]);

  const sync = useCallback(async (automatic: boolean) => {
    if (!scope || syncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    syncingRef.current = true;
    try {
      const result = await salesApi.syncPendingOfflineSales(scope);
      const detail: OfflineSalesSyncDetail = { ...result, at: new Date().toISOString(), automatic };
      if (typeof window !== "undefined") {
        if (result.synced > 0 || result.attempted > 0) {
          localStorage.setItem(offlineSalesLastSyncKey(scope), detail.at);
        }
        window.dispatchEvent(new CustomEvent<OfflineSalesSyncDetail>(OFFLINE_SALES_SYNC_EVENT, { detail }));
      }
      if (!automatic) return;
      if (result.synced > 0) toast.success(`${result.synced} offline sale${result.synced === 1 ? "" : "s"} synced`);
    } finally {
      syncingRef.current = false;
    }
  }, [scope]);

  useEffect(() => {
    if (!scope) return;
    void Promise.resolve().then(() => sync(true));
    const onOnline = () => void sync(true);
    const onOfflineSaleChanged = () => void sync(true);
    const interval = window.setInterval(() => void sync(true), SYNC_INTERVAL_MS);
    window.addEventListener("online", onOnline);
    window.addEventListener("komola:offline-sales-changed", onOfflineSaleChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("komola:offline-sales-changed", onOfflineSaleChanged);
    };
  }, [scope, sync]);

  return null;
}
