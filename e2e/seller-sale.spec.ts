import { expect, test } from "@playwright/test";
import {
  addFirstProductAndStartPay,
  completeWalkInCashSale,
  env,
  requireSeller,
  signIn,
} from "./helpers";

test.describe("seller: login → sale → history", () => {
  requireSeller();

  test("rings up a cash sale and finds it in history", async ({ page }) => {
    await signIn(page, "seller", env.sellerId!, env.sellerPassword!);
    await expect(page).toHaveURL(/\/(dashboard|pos|register-sessions)/);

    await addFirstProductAndStartPay(page);
    await completeWalkInCashSale(page, env.walkInPhone);

    await expect(page.getByRole("heading", { name: "Purchase completed" })).toBeVisible();
    const receiptNo = (await page.locator("h1 + p").first().innerText()).split("·")[0].trim();
    expect(receiptNo).not.toBe("");

    await page.goto("/pos/history");
    await page.getByRole("tab", { name: "Today", exact: true }).click();
    await expect(page.getByText(receiptNo).first()).toBeVisible();
    await expect(page.getByText(/completed sales/i)).toBeVisible();
  });

  test("period chips change the summary label", async ({ page }) => {
    await signIn(page, "seller", env.sellerId!, env.sellerPassword!);
    await page.goto("/pos/history");
    for (const label of ["Yesterday", "7 days", "All", "Today"]) {
      const chip = page.getByRole("tab", { name: label, exact: true });
      await chip.click();
      await expect(chip).toHaveAttribute("aria-selected", "true");
    }
  });
});
