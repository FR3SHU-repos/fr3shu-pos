"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { assessOfflineStorage, type OfflineScope } from "@/shared/lib/offline/sales";

export function OfflineReadinessPanel() {
  const { user } = usePosUser();
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof assessOfflineStorage>> | null>(
    null,
  );

  const scope = useMemo<OfflineScope | null>(
    () => (user ? { userId: user.id, orgId: user.orgId, locationId: user.locationId } : null),
    [user],
  );
  const load = useCallback(async () => {
    if (!scope) return;
    setStorage(await assessOfflineStorage());
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !scope) return null;

  return (
    <section
      className="rounded-[22px] border border-border bg-surface-card p-5 text-sm"
      aria-label="Offline availability"
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Works automatically
        </p>
        <p className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground-heading">
          Offline selling is available
        </p>
        <p className="text-foreground-muted">
          If the internet drops, the POS keeps saving eligible cash sales, products, and stock on
          this device. They sync automatically when the connection returns.
        </p>
      </div>
      <p className="mt-3 text-xs text-foreground-muted">
        Device storage: {storage?.status ?? "checking"}
        {storage?.persisted ? " · persistent" : ""}. Local receipts remain available until sync
        completes.
      </p>
      {storage?.status === "unsafe" ? (
        <p
          className="mt-3 rounded-xl bg-surface-muted px-3 py-3 text-xs text-foreground-body"
          role="status"
        >
          Device storage is nearly full. Free space or export a backup before continuing offline.
        </p>
      ) : null}
    </section>
  );
}
