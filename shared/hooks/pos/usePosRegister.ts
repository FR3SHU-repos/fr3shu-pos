"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { productsApi, registersApi, sellerOrgsApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { SessionDTO } from "@/shared/lib/api/registers";
import { usePosUser } from "@/shared/context/PosUserContext";
import { OFFLINE_SALES_SYNC_EVENT } from "@/shared/components/pos/OfflineSalesSyncWorker";
import {
  listPendingOfflineSales,
  readOfflineSessionContext,
  saveOfflineSessionContext,
  type OfflineScope,
} from "@/shared/lib/offline/sales";

export interface PosStore {
  name?: string;
  location?: string;
  upiId?: string;
  upiPayeeName?: string;
}

/**
 * Register session, store details, connectivity and pending-offline count.
 * Hydrates from the last saved offline context so the shell never blocks on a slow backend.
 */
export function usePosRegister(setCatalog: Dispatch<SetStateAction<ProductDTO[]>>) {
  const { user } = usePosUser();
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [store, setStore] = useState<PosStore>({});
  const [offlineSessionSavedAt, setOfflineSessionSavedAt] = useState<number | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  const offlineScope = useMemo<OfflineScope | null>(() => {
    if (!user) return null;
    return { userId: user.id, orgId: user.orgId, locationId: user.locationId };
  }, [user]);

  const refreshPendingOfflineCount = useCallback(async () => {
    if (!offlineScope) {
      setPendingOfflineCount(0);
      return;
    }
    const pending = await listPendingOfflineSales(offlineScope);
    setPendingOfflineCount(pending.length);
  }, [offlineScope]);

  const load = useCallback(async () => {
    // Do not block the POS shell indefinitely on a slow/unavailable backend.
    // The last locally saved register context is enough to render the screen;
    // catalogue hydration and server refresh can complete independently.
    const registerRemote = registersApi.overview();
    const catalogueRemote = productsApi.list({ limit: 10, status: "active" });
    const result = await Promise.race([
      registerRemote,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ]);
    const applyRegister = async (ov: Awaited<typeof registerRemote>) => {
      if (ov.success && ov.data) {
        setSession(ov.data.currentSession);
        if (offlineScope && ov.data.currentSession) {
          const saved = await saveOfflineSessionContext(offlineScope, ov.data.currentSession);
          if (saved) setOfflineSessionSavedAt(Date.now());
        }
      } else if (offlineScope) {
        const saved = await readOfflineSessionContext(offlineScope);
        if (saved) {
          setSession(saved.session);
          setOfflineSessionSavedAt(saved.savedAt);
        }
      }
    };
    const applyCatalogue = (pl: Awaited<typeof catalogueRemote>) => {
      if (pl.success && pl.data) setCatalog(pl.data.items);
    };
    if (!result) {
      if (offlineScope) {
        const saved = await readOfflineSessionContext(offlineScope);
        if (saved) {
          setSession(saved.session);
          setOfflineSessionSavedAt(saved.savedAt);
        }
      }
      await refreshPendingOfflineCount();
      setLoading(false);
      void registerRemote.then(applyRegister).catch(() => {
        // The local session remains usable when the late refresh fails.
      });
      void catalogueRemote.then(applyCatalogue).catch(() => {
        // The local session/catalogue remain usable when the late refresh fails.
      });
      return;
    }
    await applyRegister(result);
    void catalogueRemote.then(applyCatalogue).catch(() => {
      // Products can be loaded again through search when the catalogue refresh fails.
    });
    await refreshPendingOfflineCount();
    setLoading(false);
  }, [offlineScope, refreshPendingOfflineCount, setCatalog]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const updateOnline = () =>
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    const refresh = () => void refreshPendingOfflineCount();
    window.addEventListener(OFFLINE_SALES_SYNC_EVENT, refresh);
    window.addEventListener("komola:offline-sales-changed", refresh);
    return () => {
      window.removeEventListener(OFFLINE_SALES_SYNC_EVENT, refresh);
      window.removeEventListener("komola:offline-sales-changed", refresh);
    };
  }, [refreshPendingOfflineCount]);

  useEffect(() => {
    sellerOrgsApi.getMyOrganization().then((res) => {
      if (!res.success || !res.data) return;
      const locs = res.data.locations ?? [];
      const active = locs.find((l) => l.active) ?? locs[0];
      setStore({
        name: res.data.displayName,
        location: active?.name,
        upiId: res.data.organization.upiId,
        upiPayeeName: res.data.organization.upiPayeeName,
      });
    });
  }, []);

  return {
    user,
    loading,
    online,
    session,
    store,
    setStore,
    offlineScope,
    offlineSessionSavedAt,
    pendingOfflineCount,
    refreshPendingOfflineCount,
    reload: load,
  };
}
