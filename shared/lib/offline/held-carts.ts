import type { HeldCart } from "@/shared/components/pos/types";
import { offlineScopeKey, openOfflineDatabase, type OfflineScope } from "@/shared/lib/offline/sales";

const STORE = "heldCarts";
const LEGACY_KEY = "fr3shu-pos:held-carts";

interface HeldCartRecord {
  carts: HeldCart[];
  updatedAt: string;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isHeldCart(value: unknown): value is HeldCart {
  if (!value || typeof value !== "object") return false;
  const cart = value as Partial<HeldCart>;
  return typeof cart.id === "string"
    && typeof cart.label === "string"
    && typeof cart.savedAt === "string"
    && Array.isArray(cart.lines)
    && cart.lines.every((line) => Boolean(line)
      && typeof line.productId === "string"
      && typeof line.qty === "number"
      && typeof line.saleUnit === "string"
      && typeof line.discountPaise === "number");
}

function readLegacyCarts(): HeldCart[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isHeldCart).slice(0, 10) : [];
  } catch {
    return [];
  }
}

export async function saveHeldCarts(scope: OfflineScope, carts: HeldCart[]): Promise<void> {
  if (typeof indexedDB === "undefined") throw new Error("Offline cart storage is not available.");
  const db = await openOfflineDatabase();
  try {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(
      { carts: carts.slice(0, 10), updatedAt: new Date().toISOString() } satisfies HeldCartRecord,
      offlineScopeKey(scope),
    );
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function loadHeldCarts(scope: OfflineScope): Promise<HeldCart[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openOfflineDatabase();
  try {
    const transaction = db.transaction(STORE, "readonly");
    const record = await requestResult<HeldCartRecord | undefined>(
      transaction.objectStore(STORE).get(offlineScopeKey(scope)),
    );
    await transactionDone(transaction);
    if (record) return record.carts.filter(isHeldCart).slice(0, 10);
  } finally {
    db.close();
  }

  const legacy = readLegacyCarts();
  if (legacy.length > 0) await saveHeldCarts(scope, legacy);
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // IndexedDB now owns the migrated data; local cleanup is best effort.
  }
  return legacy;
}
