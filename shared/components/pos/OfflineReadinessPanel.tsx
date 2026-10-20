"use client";

import { useCallback, useEffect, useState } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { offlineApi, productsApi, registersApi } from "@/shared/lib/api";
import {
  assessOfflineStorage,
  getOfflineDeviceId,
  readOfflineReadiness,
  requestPersistentOfflineStorage,
  saveOfflineReadiness,
  type OfflineReadiness,
  type OfflineScope,
} from "@/shared/lib/offline/sales";
import { offlinePilotConfigFromEnv, offlinePilotStatus } from "@/shared/lib/offline/pilot-gate";

export function OfflineReadinessPanel() {
  const { user } = usePosUser();
  const [readiness, setReadiness] = useState<OfflineReadiness | null>(null);
  const [storage, setStorage] = useState<OfflineReadiness["storage"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const scope: OfflineScope | null = user ? { userId: user.id, orgId: user.orgId, locationId: user.locationId } : null;
  const pilotConfig = offlinePilotConfigFromEnv();
  // Register/terminal allowlists are checked after the live register and
  // stable device ID are known during preparation.
  const pilot = scope
    ? offlinePilotStatus(scope, { ...pilotConfig, registerIds: [], terminalIds: [] })
    : { enabled: false, reason: "Sign in to check pilot access." };
  const load = useCallback(async () => {
    if (!scope) return;
    const saved = await readOfflineReadiness(scope);
    setReadiness(saved);
    setStorage(await assessOfflineStorage());
  }, [scope?.userId, scope?.orgId, scope?.locationId]);

  useEffect(() => { void load(); }, [load]);

  if (!user || !scope) return null;

  const expired = readiness ? Date.parse(readiness.expiresAt) <= Date.now() : false;
  const prepare = async () => {
    setBusy(true);
    setMessage("");
    try {
      const storageState = await requestPersistentOfflineStorage();
      setStorage(storageState);
      if (storageState.status === "unsafe") throw new Error("Free device storage before preparing offline mode.");
      const overview = await registersApi.overview();
      const session = overview.data?.currentSession;
      if (!overview.success || !session) throw new Error("Open a register session online before preparing offline mode.");
      const deviceId = await getOfflineDeviceId();
      const register = overview.data?.registers.find((item) => item._id === session.registerId);
      const pilotForRegister = offlinePilotStatus({ ...scope, registerId: session.registerId, terminalId: register?.terminalId });
      if (!pilotForRegister.enabled) throw new Error(pilotForRegister.reason ?? "Offline sales are not enabled for this terminal pilot.");
      const catalogue = await productsApi.refreshOfflineProducts(undefined, { force: true });
      if (!catalogue) throw new Error("Save the product catalogue online before preparing offline mode.");
      const prepared = await offlineApi.prepare({ registerId: session.registerId, deviceId });
      if (!prepared.success || !prepared.data) throw new Error(prepared.message || "Offline preparation failed.");
      const next: OfflineReadiness = {
        deviceId,
        grantId: prepared.data.grantId,
        grantToken: prepared.data.grantToken,
        registerId: prepared.data.registerId,
        terminalId: prepared.data.terminalId,
        shiftId: prepared.data.shiftId,
        issuedAt: prepared.data.issuedAt,
        expiresAt: prepared.data.expiresAt,
        preparedAt: Date.now(),
        storage: storageState,
      };
      if (!await saveOfflineReadiness(scope, next)) throw new Error("Could not save offline readiness on this device.");
      setReadiness(next);
      setMessage("Offline mode is prepared for this open register session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Offline preparation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface-card p-4 text-sm" aria-label="Offline readiness">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Device operations</p>
          <p className="mt-1 font-semibold text-foreground-heading">Offline readiness</p>
          <p className="text-foreground-muted">
            {!pilot.enabled ? "Offline checkout is not enabled for this terminal." : readiness && !expired ? `Prepared until ${new Date(readiness.expiresAt).toLocaleString()}.` : "Prepare this device and register online before accepting offline cash sales."}
          </p>
        </div>
        <button type="button" disabled={busy || !pilot.enabled || typeof navigator !== "undefined" && !navigator.onLine} onClick={() => void prepare()} className="min-h-11 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Preparing…" : readiness && !expired ? "Prepare again" : "Prepare offline mode"}
        </button>
      </div>
      <p className="mt-2 text-xs text-foreground-muted">Pilot: {pilot.enabled ? "enabled" : "disabled"}. Storage: {storage?.status ?? "checking"}{storage?.persisted ? " · persistent" : ""}. Offline checkout remains cash-only, requires the signed-in workspace, and expires with the server grant.</p>
      {!pilot.enabled ? <p className="mt-3 rounded-xl bg-surface-muted px-3 py-3 text-xs text-foreground-body" role="status">{pilot.reason ?? "Offline preparation will become available when this pilot is enabled."}</p> : null}
      {message ? <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs" role="status">{message}</p> : null}
    </section>
  );
}
