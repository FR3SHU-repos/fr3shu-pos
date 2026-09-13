import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, createServerClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  return { getUser, createServerClient: vi.fn(() => ({ auth: { getUser } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
});

describe("session middleware network boundary", () => {
  it.each(["/", "/login/seller", "/register/buyer", "/auth/callback?code=test", "/api/v1/pos/products"])(
    "does not contact Supabase before serving %s", async (path) => {
      const { updateSession } = await import("@/shared/lib/supabase/middleware");
      const response = await updateSession(new NextRequest(`https://example.com${path}`));
      expect(response.status).toBe(200);
      expect(createServerClient).not.toHaveBeenCalled();
    },
  );

  it("still verifies authentication on protected pages", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("@/shared/lib/supabase/middleware");
    const response = await updateSession(new NextRequest("https://example.com/dashboard"));
    expect(getUser).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("https://example.com/login?next=%2Fdashboard");
  });

  it("preserves fallback OAuth code exchange before route gating", async () => {
    const { updateSession } = await import("@/shared/lib/supabase/middleware");
    const response = await updateSession(new NextRequest("https://example.com/dashboard?code=12345678-1234-1234-1234-123456789012"));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/callback");
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
