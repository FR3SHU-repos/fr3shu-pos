import { expect, test } from "@playwright/test";
import { env, requireBuyer, signIn } from "./helpers";

test.describe("buyer: login → code and QR", () => {
  requireBuyer();

  test("shows points, a buyer code and its QR", async ({ page }) => {
    await signIn(page, "buyer", env.buyerId!, env.buyerPassword!);
    await expect(page).toHaveURL(/\/buyer/);

    await expect(page.getByLabel("Komola Coin balance")).toBeVisible();
    const codeCard = page.locator('section[aria-labelledby="buyer-code-title"]');
    await expect(codeCard.locator("svg").first()).toBeVisible();
    await expect(codeCard).toContainText(/BYR-[A-F0-9]{10}/);
  });
});
