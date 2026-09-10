"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, identityApi } from "@/shared/lib/api";
import type { SessionUser } from "@/shared/lib/api/auth";
import type { Capabilities } from "@/shared/lib/api/identity";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

interface PosUserContextValue {
  user: SessionUser | null;
  capabilities: Capabilities | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const PosUserContext = createContext<PosUserContextValue>({
  user: null,
  capabilities: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
  logout: async () => {},
});

export function PosUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [session, access] = await Promise.all([authApi.me(), identityApi.capabilities()]);
    setUser(session.success ? session.data : null);
    setCapabilities(access.success ? access.data : null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setCapabilities(null);
  }, []);

  useEffect(() => {
    void refresh();

    const supabase = createAuthBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setCapabilities(null);
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
    <PosUserContext.Provider value={{ user, capabilities, loading, setUser, refresh, logout }}>
      {children}
    </PosUserContext.Provider>
  );
}

export const usePosUser = () => useContext(PosUserContext);
