"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authApi, bootstrapApi } from "@/shared/lib/api";
import type { SessionUser } from "@/shared/lib/api/auth";
import type { Capabilities } from "@/shared/lib/api/identity";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

import { setProductScope } from "@/shared/lib/offline/products";
import { lockOfflineScope, setOfflineActiveScope, type OfflineScope } from "@/shared/lib/offline/sales";
import type { MyOrganization } from "@/shared/lib/api/sellerOrgs";

interface PosUserContextValue {
  user: SessionUser | null;
  capabilities: Capabilities | null;
  organization: MyOrganization | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const PosUserContext = createContext<PosUserContextValue>({
  user: null,
  capabilities: null,
  organization: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
  logout: async () => {},
});

export function PosUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [organization, setOrganization] = useState<MyOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<SessionUser | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const request = (async () => {
      const {
        data: { session },
      } = await createAuthBrowserClient().auth.getSession();
      if (!session) {
        if (userRef.current) lockOfflineScope(toOfflineScope(userRef.current));
        setOfflineActiveScope(null);
        setProductScope(null);
        setUser(null);
        setCapabilities(null);
        setOrganization(null);
        setLoading(false);
        return;
      }

      const result = await bootstrapApi.load();
      // A connection loss must not evict an already open seller workspace.
      if (result.status === 0 || result.status >= 500) {
        setLoading(false);
        return;
      }

      if (result.status === 401) {
        const { data: { session } } = await createAuthBrowserClient().auth.getSession();
        // A stale API token or a short Supabase hiccup is not a user logout.
        // The auth listener will clear the workspace if Supabase really signs out.
        if (session) {
          setLoading(false);
          return;
        }
      }

      const nextUser = result.success ? result.data?.user ?? null : null;
      if (userRef.current && (!nextUser || offlineScopeKey(userRef.current) !== offlineScopeKey(nextUser))) {
        lockOfflineScope(toOfflineScope(userRef.current));
      }
      userRef.current = nextUser;
      setOfflineActiveScope(nextUser ? toOfflineScope(nextUser) : null);
      setProductScope(nextUser);
      setUser(nextUser);
      setCapabilities(result.success ? result.data?.capabilities ?? null : null);
      setOrganization(result.success ? result.data?.organization ?? null : null);
      setLoading(false);
    })();

    refreshInFlight.current = request;
    try {
      await request;
    } finally {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    if (userRef.current) lockOfflineScope(toOfflineScope(userRef.current));
    setOfflineActiveScope(null);
    setProductScope(null);
    await authApi.logout();
    setUser(null);
    setCapabilities(null);
    setOrganization(null);
  }, []);

  useEffect(() => {
    void refresh();

    const supabase = createAuthBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (userRef.current) lockOfflineScope(toOfflineScope(userRef.current));
        setOfflineActiveScope(null);
        setProductScope(null);
        setUser(null);
        setCapabilities(null);
        setOrganization(null);
        setLoading(false);
        return;
      }
      // The initial refresh already handles a new OAuth session. Only retry
      // SIGNED_IN when that refresh did not establish a user; otherwise this
      // event would issue a duplicate bootstrap request immediately after login.
      if (event === "SIGNED_IN" && !userRef.current) {
        void refresh();
      }
      if (event === "USER_UPDATED") {
        void refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  return (
    <PosUserContext.Provider value={{ user, capabilities, organization, loading, setUser, refresh, logout }}>
      {children}
    </PosUserContext.Provider>
  );
}

function toOfflineScope(user: Pick<SessionUser, "id" | "orgId" | "locationId">): OfflineScope {
  return { userId: user.id, orgId: user.orgId, locationId: user.locationId };
}

function offlineScopeKey(user: Pick<SessionUser, "id" | "orgId" | "locationId">): string {
  return JSON.stringify([user.id, user.orgId, user.locationId]);
}

export const usePosUser = () => useContext(PosUserContext);
