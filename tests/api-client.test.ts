import { afterEach, describe, expect, it, vi } from "vitest";
import { apiURL, request } from "@/shared/lib/api/client";
import { setPersonalWorkspace } from "@/shared/lib/seller-workspace";

vi.mock("@/shared/lib/supabase/auth-client", () => ({
  createAuthBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}));

afterEach(() => {
  setPersonalWorkspace(null);
  vi.unstubAllGlobals();
});

describe("API URL joining", () => {
  it("normalizes trailing and API-prefix slashes", () => {
    expect(apiURL("/products", "https://api.example.com/")).toBe(
      "https://api.example.com/api/v1/products",
    );
    expect(apiURL("products", "https://api.example.com/api/v1")).toBe(
      "https://api.example.com/api/v1/products",
    );
  });

  it("keeps the default browser target same-origin", () => {
    expect(apiURL("me/referrals")).toBe("/api/v1/me/referrals");
  });
});

describe("seller workspace scoping", () => {
  it("keeps seller operations in the selected workspace and account reads unscoped", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem: () => "selected-group" });
    const fetch = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) =>
      Response.json({ success: true }),
    );
    vi.stubGlobal("fetch", fetch);

    await request("pos/sales");
    await request("me/group-join-requests");
    await request("pos/bootstrap", { workspace: "personal" });
    await request("pos/sales", { headers: { "X-Organization-ID": "closed-group" } });

    expect(fetch.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ headers: { "X-Organization-ID": "selected-group" } }),
      expect.objectContaining({ headers: {} }),
      expect.objectContaining({ headers: {} }),
      expect.objectContaining({ headers: { "X-Organization-ID": "closed-group" } }),
    ]);
  });
});
