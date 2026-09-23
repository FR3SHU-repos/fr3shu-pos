"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, bootstrapApi } from "@/shared/lib/api";
import type { SessionUser } from "@/shared/lib/api/auth";
import type { Capabilities } from "@/shared/lib/api/identity";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

import { setProductScope } from "@/shared/lib/offline/products";
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

  const refresh = useCallback(async () => {
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
    setProductScope(result.success ? result.data?.user ?? null : null);
    setUser(result.success ? result.data?.user ?? null : null);
    setCapabilities(result.success ? result.data?.capabilities ?? null : null);
    setOrganization(result.success ? result.data?.organization ?? null : null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
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
        setProductScope(null);
        setUser(null);
        setCapabilities(null);
        setOrganization(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
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

export const usePosUser = () => useContext(PosUserContext);
