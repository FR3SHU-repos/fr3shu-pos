"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "@/shared/lib/api";
import type { SessionUser } from "@/shared/lib/api/auth";
import { createAuthBrowserClient } from "@/shared/lib/supabase/auth-client";

interface PosUserContextValue {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const PosUserContext = createContext<PosUserContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
  logout: async () => {},
});

export function PosUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await authApi.me();
    setUser(res.success ? res.data : null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();

    const supabase = createAuthBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
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
    <PosUserContext.Provider value={{ user, loading, setUser, refresh, logout }}>
      {children}
    </PosUserContext.Provider>
  );
}

export const usePosUser = () => useContext(PosUserContext);
