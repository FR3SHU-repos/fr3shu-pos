import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  configureOfflineLocalUnlock,
  isOfflineLocalUnlockOpen,
  lockOfflineScope,
  offlineScopeKey,
  unlockOfflineLocalScope,
  type OfflineScope,
} from "@/shared/lib/offline/sales";

const scope: OfflineScope = { userId: "user-1", orgId: "org-1", locationId: "loc-1" };

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  } as Storage;
}

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("komola-offline-pos-v1");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => vi.unstubAllGlobals());

describe("offline local unlock", () => {
  it("requires the configured PIN and locks the scope again", async () => {
    expect(offlineScopeKey(scope)).toBe(JSON.stringify(["user-1", "org-1", "loc-1"]));
    await expect(configureOfflineLocalUnlock(scope, "123456")).resolves.toBe(true);
    await expect(unlockOfflineLocalScope(scope, "000000")).resolves.toBe(false);
    await expect(isOfflineLocalUnlockOpen(scope)).resolves.toBe(false);
    await expect(unlockOfflineLocalScope(scope, "123456")).resolves.toBe(true);
    await expect(isOfflineLocalUnlockOpen(scope)).resolves.toBe(true);
    lockOfflineScope(scope);
    await expect(isOfflineLocalUnlockOpen(scope)).resolves.toBe(false);
  });
});
