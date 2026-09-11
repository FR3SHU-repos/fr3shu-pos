import { describe, expect, it } from "vitest";
import { requestOrigin } from "@/shared/lib/http/request-origin";

function request(url: string, headers: Record<string, string> = {}) {
  return { headers: new Headers(headers), nextUrl: new URL(url) };
}

describe("requestOrigin", () => {
  it("keeps localhost for local authentication", () => {
    expect(requestOrigin(request("http://localhost:3000/login"))).toBe("http://localhost:3000");
  });

  it("uses the public forwarded host instead of a Netlify deploy host", () => {
    expect(requestOrigin(request("https://deploy-id--fr3shu-pos.netlify.app/auth/callback", {
      "x-forwarded-host": "pos.komola.in",
      "x-forwarded-proto": "https",
    }))).toBe("https://pos.komola.in");
  });
});
