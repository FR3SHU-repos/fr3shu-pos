import { describe, expect, it } from "vitest";
import { apiURL } from "@/shared/lib/api/client";

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
