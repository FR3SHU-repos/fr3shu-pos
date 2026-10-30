import { expect, test } from "@playwright/test";
import { completeWalkInCashSale, env, requireSeller, signIn } from "./helpers";

test.describe("seller: offline cash sale syncs", () => {
  requireSeller();

  test("saves a sale offline, then syncs when the network returns", async ({ page, context }) => {
    await signIn(page, "seller", env.sellerId!, env.sellerPassword!);
    await page.goto("/pos");
    // Let the register context and catalogue cache before going offline.
    await expect(page.locator("button", { hasText: /Stock:/ }).first()).toBeVisible();

    await context.setOffline(true);
    await page
      .locator("button", { hasText: /Stock:/ })
      .first()
      .click();
    await page.getByRole("button", { name: /^Pay ·/ }).click();
    await completeWalkInCashSale(page, env.walkInPhone);
    await expect(page.getByText(/saved safely on this device/i)).toBeVisible();

    await context.setOffline(false);
    await page.goto("/pos/history");
    // The "waiting to sync" note disappears once the sync worker has uploaded the sale.
    await expect(page.getByText(/waiting to sync/i)).toHaveCount(0, { timeout: 60_000 });
  });
});
