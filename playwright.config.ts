import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests drive a running KOMOLA stack (web app + Go API + Supabase) with real
 * test accounts, so they are opt-in: they skip unless E2E_* variables are set.
 * See e2e/README.md. Vitest (`npm test`) never picks these up.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
