import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { loadHeldCarts, saveHeldCarts } from "@/shared/lib/offline/held-carts";
import type { HeldCart } from "@/shared/components/pos/types";
import { openOfflineDatabase, type OfflineScope } from "@/shared/lib/offline/sales";

const scopeA: OfflineScope = { userId: "seller-a", orgId: "org-1", locationId: "loc-1" };
const scopeB: OfflineScope = { userId: "seller-b", orgId: "org-1", locationId: "loc-1" };
const cart: HeldCart = {
  id: "cart-1",
  label: "1 item · ₹60.00",
  savedAt: "2026-09-16T06:00:00.000Z",
  lines: [{ productId: "sku-1", qty: 1, saleUnit: "kg", discountPaise: 0 }],
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("komola-offline-pos-v1");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function installLocalStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
}

beforeEach(async () => {
  await deleteDatabase();
  installLocalStorage();
});

describe("offline held carts", () => {
  it("adds the held-cart store without deleting existing offline sales", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("komola-offline-pos-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("sales", { keyPath: "id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("sales", "readwrite");
        transaction.objectStore("sales").put({ id: "pending-sale", syncState: "pending" });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });

    const upgraded = await openOfflineDatabase();
    const transaction = upgraded.transaction("sales", "readonly");
    const existing = await new Promise<{ id: string } | undefined>((resolve, reject) => {
      const request = transaction.objectStore("sales").get("pending-sale");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    upgraded.close();

    expect(existing?.id).toBe("pending-sale");
  });

  it("persists carts across reloads and isolates seller scopes", async () => {
    await saveHeldCarts(scopeA, [cart]);

    expect(await loadHeldCarts(scopeA)).toEqual([cart]);
    expect(await loadHeldCarts(scopeB)).toEqual([]);
  });

  it("moves valid legacy localStorage carts into scoped IndexedDB once", async () => {
    localStorage.setItem("fr3shu-pos:held-carts", JSON.stringify([cart, { invalid: true }]));

    expect(await loadHeldCarts(scopeA)).toEqual([cart]);
    expect(localStorage.getItem("fr3shu-pos:held-carts")).toBeNull();
    expect(await loadHeldCarts(scopeA)).toEqual([cart]);
  });
});
