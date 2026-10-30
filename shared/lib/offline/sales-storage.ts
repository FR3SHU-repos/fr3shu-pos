import type { SessionDTO } from "@/shared/lib/api/registers";
import { newUuid } from "@/shared/lib/uuid";
import {
  offlineScopeKey,
  type OfflineReadiness,
  type OfflineScope,
  type OfflineStorageReadiness,
} from "@/shared/lib/offline/sales-types";

export const DB_NAME = "komola-offline-pos-v1";
export const DB_VERSION = 3;
export const SALE_STORE = "sales";
export const OUTBOX_STORE = "outbox";
export const CONTEXT_STORE = "contexts";
export const META_STORE = "meta";
export const HELD_CART_STORE = "heldCarts";
export const READINESS_STORE = "readiness";

const OFFLINE_DEVICE_ID_KEY = "offline-device-id";
const ACTIVE_SCOPE_KEY = "komola:offline-active-scope";
const MIN_OFFLINE_HEADROOM_BYTES = 10 * 1024 * 1024;

export function notifyOfflineSalesChanged(): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("komola:offline-sales-changed"));
}

function sessionStorageSafe(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Selects the current authenticated scope for browser-side offline reads. */
export function setOfflineActiveScope(scope: OfflineScope | null): void {
  const storage = sessionStorageSafe();
  if (!storage) return;
  if (!scope) storage.removeItem(ACTIVE_SCOPE_KEY);
  else storage.setItem(ACTIVE_SCOPE_KEY, offlineScopeKey(scope));
}

export function lockOfflineScope(scope: OfflineScope): void {
  const storage = sessionStorageSafe();
  if (!storage) return;
  if (storage.getItem(ACTIVE_SCOPE_KEY) === offlineScopeKey(scope))
    storage.removeItem(ACTIVE_SCOPE_KEY);
}

export function offlineScopeIsActive(scope: OfflineScope): boolean {
  if (process.env.NODE_ENV === "test" || typeof window === "undefined") return true;
  return sessionStorageSafe()?.getItem(ACTIVE_SCOPE_KEY) === offlineScopeKey(scope);
}

export async function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SALE_STORE))
        db.createObjectStore(SALE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE))
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CONTEXT_STORE)) db.createObjectStore(CONTEXT_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(HELD_CART_STORE)) db.createObjectStore(HELD_CART_STORE);
      if (!db.objectStoreNames.contains(READINESS_STORE)) db.createObjectStore(READINESS_STORE);
    };
    request.onblocked = () =>
      reject(
        new Error(
          "Offline storage is waiting for another KOMOLA tab to close before it can update. Close older tabs and try again.",
        ),
      );
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Offline storage could not be opened."));
  });
}

export async function getOfflineDeviceId(): Promise<string> {
  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    const existing = await requestResult<string | undefined>(store.get(OFFLINE_DEVICE_ID_KEY));
    if (existing) {
      await txDone(tx);
      return existing;
    }
    const generated = globalThis.crypto?.randomUUID?.() ?? newUuid();
    store.put(generated, OFFLINE_DEVICE_ID_KEY);
    await txDone(tx);
    return generated;
  } finally {
    db.close();
  }
}

export async function assessOfflineStorage(): Promise<OfflineStorageReadiness> {
  const checkedAt = Date.now();
  if (typeof indexedDB === "undefined") return { status: "unsafe", persisted: false, checkedAt };
  let persisted = false;
  let availableBytes: number | undefined;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persisted)
      persisted = await navigator.storage.persisted();
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.quota === "number" && typeof estimate.usage === "number")
        availableBytes = Math.max(0, estimate.quota - estimate.usage);
    }
  } catch {
    return { status: "unknown", persisted, checkedAt };
  }
  if (availableBytes !== undefined && availableBytes < MIN_OFFLINE_HEADROOM_BYTES)
    return { status: "unsafe", persisted, availableBytes, checkedAt };
  return {
    status: availableBytes === undefined ? "unknown" : "ready",
    persisted,
    availableBytes,
    checkedAt,
  };
}

export async function requestPersistentOfflineStorage(): Promise<OfflineStorageReadiness> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist)
      await navigator.storage.persist();
  } catch {
    // Persistence is a browser policy decision; the quota check below remains authoritative.
  }
  return assessOfflineStorage();
}

export async function saveOfflineReadiness(
  scope: OfflineScope,
  readiness: OfflineReadiness,
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(READINESS_STORE, "readwrite");
    tx.objectStore(READINESS_STORE).put(readiness, `${offlineScopeKey(scope)}:readiness`);
    await txDone(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function readOfflineReadiness(scope: OfflineScope): Promise<OfflineReadiness | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(READINESS_STORE, "readonly");
    const readiness = await requestResult<OfflineReadiness | undefined>(
      tx.objectStore(READINESS_STORE).get(`${offlineScopeKey(scope)}:readiness`),
    );
    await txDone(tx);
    db.close();
    return readiness ?? null;
  } catch {
    return null;
  }
}

export async function saveOfflineSessionContext(
  scope: OfflineScope,
  session: SessionDTO,
): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(CONTEXT_STORE, "readwrite");
    tx.objectStore(CONTEXT_STORE).put({ session, savedAt: Date.now() }, offlineScopeKey(scope));
    await txDone(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function readOfflineSessionContext(
  scope: OfflineScope,
): Promise<{ session: SessionDTO; savedAt: number } | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openOfflineDatabase();
    const tx = db.transaction(CONTEXT_STORE, "readonly");
    const result = await requestResult<{ session: SessionDTO; savedAt: number } | undefined>(
      tx.objectStore(CONTEXT_STORE).get(offlineScopeKey(scope)),
    );
    await txDone(tx);
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export function storageError(error: unknown): Error | unknown {
  const name =
    error instanceof DOMException
      ? error.name
      : error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
  if (["QuotaExceededError", "InvalidStateError", "AbortError", "VersionError"].includes(name)) {
    if (name === "QuotaExceededError")
      return new Error(
        "Offline storage is full. Export a backup or free device storage before continuing.",
      );
    if (name === "VersionError")
      return new Error(
        "Offline storage needs another KOMOLA tab to close before it can be upgraded. Close older tabs and try again.",
      );
    return new Error(
      "Offline storage could not complete this operation. Keep the local receipt and try again.",
    );
  }
  return error;
}
