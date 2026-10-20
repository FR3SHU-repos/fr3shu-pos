"use client";

import { useCallback, useEffect, useState } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import {
  assessOfflineStorage,
  type OfflineScope,
} from "@/shared/lib/offline/sales";

export function OfflineReadinessPanel() {
  const { user } = usePosUser();
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof assessOfflineStorage>> | null>(null);

  const scope: OfflineScope | null = user ? { userId: user.id, orgId: user.orgId, locationId: user.locationId } : null;
  const load = useCallback(async () => {
    if (!scope) return;
    setStorage(await assessOfflineStorage());
  }, [scope?.userId, scope?.orgId, scope?.locationId]);

  useEffect(() => { void load(); }, [load]);

  if (!user || !scope) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface-card p-4 text-sm" aria-label="Offline readiness">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Device operations</p>
        <p className="mt-1 font-semibold text-foreground-heading">Offline sales</p>
        <p className="text-foreground-muted">
          If the internet drops, the POS keeps saving sales, products, and stock on this device. They sync automatically when the connection returns.
        </p>
      </div>
      <p className="mt-3 text-xs text-foreground-muted">
        Storage: {storage?.status ?? "checking"}{storage?.persisted ? " · persistent" : ""}. Offline checkout accepts cash and keeps the local receipt until sync completes.
      </p>
      {storage?.status === "unsafe" ? (
        <p className="mt-3 rounded-xl bg-surface-muted px-3 py-3 text-xs text-foreground-body" role="status">
          Device storage is nearly full. Free space or export a backup before continuing offline.
        </p>
      ) : null}
    </section>
  );
}
