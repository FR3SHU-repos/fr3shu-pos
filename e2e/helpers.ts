import { expect, test, type Page } from "@playwright/test";

export const env = {
  sellerId: process.env.E2E_SELLER_IDENTIFIER,
  sellerPassword: process.env.E2E_SELLER_PASSWORD,
  buyerId: process.env.E2E_BUYER_IDENTIFIER,
  buyerPassword: process.env.E2E_BUYER_PASSWORD,
  /** Phone used for the walk-in customer on the test sale. */
  walkInPhone: process.env.E2E_WALKIN_PHONE ?? "9876543210",
};

export function requireSeller() {
  test.skip(
    !env.sellerId || !env.sellerPassword,
    "Set E2E_SELLER_IDENTIFIER and E2E_SELLER_PASSWORD",
  );
}

export function requireBuyer() {
  test.skip(!env.buyerId || !env.buyerPassword, "Set E2E_BUYER_IDENTIFIER and E2E_BUYER_PASSWORD");
}

export async function signIn(
  page: Page,
  role: "seller" | "buyer",
  identifier: string,
  password: string,
) {
  await page.goto(`/login/${role}`);
  await page.getByLabel("Email or mobile number").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Adds the first in-stock product tile to the cart and opens checkout (desktop layout). */
export async function addFirstProductAndStartPay(page: Page) {
  await page.goto("/pos");
  const tile = page.locator("button:not([disabled])", { hasText: /Stock:/ }).first();
  await expect(tile, "needs at least one in-stock product and an open register").toBeVisible();
  await tile.click();
  await page.getByRole("button", { name: /^Pay ·/ }).click();
}

/** Fills the walk-in customer block and confirms the sale with cash (amount is pre-filled). */
export async function completeWalkInCashSale(page: Page, phone: string) {
  await page.getByPlaceholder("Customer name").fill("E2E Walk-in");
  await page.getByPlaceholder(/mobile|phone/i).fill(phone);
  await page.getByRole("button", { name: /Complete sale/i }).click();
}
