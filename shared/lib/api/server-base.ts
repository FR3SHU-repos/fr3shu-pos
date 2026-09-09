const LOCAL_GO_API = "http://localhost:8080";

/**
 * Resolve the server-side Go API target. Development is deliberately pinned to
 * the local API so a stale shell variable cannot send localhost traffic to the
 * deployed Render service.
 */
export function serverGoApiBase(): string {
  if (process.env.NODE_ENV === "development") return LOCAL_GO_API;

  const raw =
    process.env.GO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CATALOGUE_API_BASE_URL;
  return (raw?.trim() ?? "").replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}
