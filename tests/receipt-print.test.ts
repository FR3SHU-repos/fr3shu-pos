import { describe, expect, it } from "vitest";
import { printReceipt } from "@/shared/lib/offline/receipt-print";

describe("receipt printing", () => {
  it("does not crash when printing is unavailable outside a browser", () => {
    expect(printReceipt()).toBe(false);
  });
});
