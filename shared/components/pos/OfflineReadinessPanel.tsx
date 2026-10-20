"use client";

import { useCallback, useEffect, useState } from "react";
import { usePosUser } from "@/shared/context/PosUserContext";
import { offlineApi, productsApi, registersApi } from "@/shared/lib/api";
import {
  assessOfflineStorage,
  getOfflineDeviceId,
  configureOfflineLocalUnlock,
  hasOfflineLocalUnlock,
  isOfflineLocalUnlockOpen,
  readOfflineReadiness,
  requestPersistentOfflineStorage,
  saveOfflineReadiness,
  unlockOfflineLocalScope,
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
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [unlockPin, setUnlockPin] = useState("");
  const [localUnlockConfigured, setLocalUnlockConfigured] = useState(false);
  const [localUnlocked, setLocalUnlocked] = useState(false);

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
    setLocalUnlockConfigured(await hasOfflineLocalUnlock(scope));
    setLocalUnlocked(await isOfflineLocalUnlockOpen(scope));
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
      if (!/^\d{6}$/.test(pin) || pin !== pinConfirmation) throw new Error("Choose and confirm a six-digit local unlock PIN.");
      const prepared = await offlineApi.prepare({ registerId: session.registerId, deviceId });
      if (!prepared.success || !prepared.data) throw new Error(prepared.message || "Offline preparation failed.");
      if (!await configureOfflineLocalUnlock(scope, pin)) throw new Error("Could not save the local unlock PIN on this device.");
      if (!await unlockOfflineLocalScope(scope, pin)) throw new Error("The local unlock PIN could not be opened.");
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
        localUnlockRequired: true,
      };
      if (!await saveOfflineReadiness(scope, next)) throw new Error("Could not save offline readiness on this device.");
      setReadiness(next);
      setLocalUnlockConfigured(true);
      setLocalUnlocked(true);
      setPin("");
      setPinConfirmation("");
      setMessage("Offline mode is prepared for this open register session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Offline preparation failed.");
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!await unlockOfflineLocalScope(scope, unlockPin)) throw new Error("That local unlock PIN is incorrect.");
      setLocalUnlocked(true);
      setUnlockPin("");
      setMessage("Offline register unlocked for this browser session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The offline register could not be unlocked.");
    } finally {
      setBusy(false);
    }
  };

  const needsSetupPin = !readiness || readiness.localUnlockRequired !== true || !localUnlockConfigured;

  return (
    <section className="mb-4 rounded-xl border border-border bg-surface-card p-3 text-sm" aria-label="Offline readiness">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground-heading">Offline readiness</p>
          <p className="text-foreground-muted">
            {readiness && !expired ? `Prepared until ${new Date(readiness.expiresAt).toLocaleString()}.` : "Prepare this device and register online before accepting offline cash sales."}
          </p>
        </div>
        <button type="button" disabled={busy || !pilot.enabled || typeof navigator !== "undefined" && !navigator.onLine} onClick={() => void prepare()} className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Preparing…" : readiness && !expired ? "Prepare again" : "Prepare offline mode"}
        </button>
      </div>
      {needsSetupPin ? (
        <div className="mt-3 grid gap-2 rounded-lg bg-surface p-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-foreground-body">Local unlock PIN
            <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="new-password" type="password" maxLength={6} placeholder="6 digits" className="mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-foreground-body">Confirm PIN
            <input value={pinConfirmation} onChange={(event) => setPinConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="new-password" type="password" maxLength={6} placeholder="Repeat PIN" className="mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm" />
          </label>
          <p className="text-xs text-foreground-muted sm:col-span-2">This PIN is stored only as a salted verifier on this browser. It is required after the browser restarts before offline checkout can continue.</p>
        </div>
      ) : readiness && !localUnlocked ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-surface p-3">
          <label className="text-xs font-semibold text-foreground-body">Unlock offline register
            <input value={unlockPin} onChange={(event) => setUnlockPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="current-password" type="password" maxLength={6} placeholder="6 digits" className="mt-1 block w-40 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm" />
          </label>
          <button type="button" disabled={busy || unlockPin.length !== 6} onClick={() => void unlock()} className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-semibold text-foreground-body disabled:opacity-50">Unlock</button>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-foreground-muted">Pilot: {pilot.enabled ? "enabled" : "disabled"}. Storage: {storage?.status ?? "checking"}{storage?.persisted ? " · persistent" : ""}. Offline checkout remains cash-only and expires with the server grant.</p>
      {!pilot.enabled ? <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs" role="status">{pilot.reason}</p> : null}
      {message ? <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs" role="status">{message}</p> : null}
    </section>
  );
}
