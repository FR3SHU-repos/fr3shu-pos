import { describe, expect, it } from "vitest";
import { apiURL } from "@/shared/lib/api/client";

describe("API URL joining", () => {
  it("normalizes trailing and API-prefix slashes", () => {
    expect(apiURL("/products", "https://api.example.com/")).toBe("https://api.example.com/api/v1/products");
    expect(apiURL("products", "https://api.example.com/api/v1")).toBe("https://api.example.com/api/v1/products");
  });
});
