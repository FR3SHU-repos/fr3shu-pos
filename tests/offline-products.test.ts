import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductDTO } from "@/shared/lib/api/products";
import { searchProducts, setProductScope, productScope, readProducts } from "@/shared/lib/offline/products";

const items = [
  { _id: "1", name: "Organic Rice", sku: "RICE-1", barcode: "123456", status: "active" },
  { _id: "2", name: "Brown Rice", sku: "RICE-2", status: "inactive" },
  { _id: "3", name: "Milk", sku: "MILK", status: "active" },
] as ProductDTO[];

describe("saved catalogue search", () => {
  it("searches name, SKU and barcode without a server", () => {
    expect(searchProducts(items, { q: " ORGANIC " }).items[0]._id).toBe("1");
    expect(searchProducts(items, { q: "rice-2" }).items[0]._id).toBe("2");
    expect(searchProducts(items, { q: "123456" }).items[0]._id).toBe("1");
  });
  it("filters status before paginating", () => {
    const result = searchProducts(items, { status: "active", page: 2, limit: 1 });
    expect(result.items[0]._id).toBe("3");
    expect(result.meta).toEqual({ total: 2, totalPages: 2, limit: 1, page: 2 });
    expect(searchProducts(items, { status: "all" }).items).toHaveLength(3);
  });
  it("isolates user, organization and location and disables reads on logout", async () => {
    setProductScope({ id: "a", orgId: "org", locationId: "1" });
    const a = productScope();
    setProductScope({ id: "a", orgId: "org", locationId: "2" });
    expect(productScope()).not.toBe(a);
    setProductScope(null);
    expect(await readProducts()).toBeNull();
  });
});

const mocks = vi.hoisted(() => ({ request: vi.fn(), read: vi.fn(), write: vi.fn(), offline: false, scope: "seller" }));
vi.mock("@/shared/lib/api/client", () => ({ goRequest: mocks.request }));
// Keep the pure helpers real, replace browser persistence at the API boundary.
vi.mock("@/shared/lib/offline/products", async importOriginal => {
  const actual = await importOriginal<typeof import("@/shared/lib/offline/products")>();
  return { ...actual, isOffline: () => mocks.offline };
});

import * as products from "@/shared/lib/api/products";
beforeEach(() => { mocks.offline = false; mocks.request.mockReset(); });
describe("offline product API", () => {
  it("fails clearly without a downloaded catalogue and makes no network request", async () => {
    mocks.offline = true;
    setProductScope(null);
    const result = await products.list({ q: "rice" });
    expect(result.success).toBe(false);
    expect(result.code).toBe("offline_unavailable");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("does not silently queue or report offline edits as saved", async () => {
    mocks.offline = true;
    const result = await products.update("1", { name: "Rice", saleUnit: "kg", taxRateBps: 0, organicStatus: "Verified" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("not been saved");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("does not substitute cache for permission errors", async () => {
    mocks.request.mockResolvedValue({ success: false, data: null, status: 403, message: "Forbidden" });
    expect((await products.list()).status).toBe(403);
  });
  it("does not publish an incomplete catalogue download", async () => {
    setProductScope({ id: "a", orgId: "org", locationId: "1" });
    mocks.request.mockResolvedValueOnce({ success: true, data: { items: [], meta: { totalPages: 2 } }, status: 200 });
    expect(await products.syncOfflineProducts()).toBe(false);
  });
});
