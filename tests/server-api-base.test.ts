import { afterEach, describe, expect, it, vi } from "vitest";
import { serverGoApiBase } from "@/shared/lib/api/server-base";

describe("serverGoApiBase", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("pins development traffic to the local Go API", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GO_API_BASE_URL", "https://example-backend.onrender.com");

    expect(serverGoApiBase()).toBe("http://localhost:8080");
  });

  it("uses and normalizes the deployment target in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GO_API_BASE_URL", "https://example-backend.onrender.com/api/v1/");

    expect(serverGoApiBase()).toBe("https://example-backend.onrender.com");
  });
});
