import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocation,
  isLinkPending,
  registerSeller,
  type RegisterSellerBody,
} from "@/shared/lib/api/sellerOrgs";

const body: RegisterSellerBody = {
  organization: { legalName: "Green Harvest FPO", type: "FPO" },
  location: { code: "GHMVP", name: "MVP Stall" },
};

function mockFetchOnce(status: number, json: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sellerOrgs client", () => {
  it("POSTs seller registration to /api/v1/seller-organizations with an Idempotency-Key", async () => {
    const fetchMock = mockFetchOnce(201, {
      success: true,
      message: "ok",
      data: { organization: { id: "o1", status: "Pending" }, created: true, reused: false },
    });

    const res = await registerSeller(body, "idem-123");

    expect(res.success).toBe(true);
    expect(res.data?.organization.status).toBe("Pending");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/seller-organizations$/);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-123");
  });

  it("detects the link-pending retry signal from status or code", () => {
    expect(isLinkPending({ success: false, message: "", data: null, status: 202 })).toBe(true);
    expect(
      isLinkPending({ success: false, message: "", data: null, status: 200, code: "onboarding_link_pending" }),
    ).toBe(true);
    expect(isLinkPending({ success: true, message: "", data: null, status: 201 })).toBe(false);
  });

  it("builds the nested locations path with an encoded org id", async () => {
    const fetchMock = mockFetchOnce(201, { success: true, message: "ok", data: { id: "l1", code: "GHBR1" } });

    await createLocation("org/1", { code: "GHBR1", name: "Branch 1" });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/seller-organizations\/org%2F1\/locations$/);
  });
});
