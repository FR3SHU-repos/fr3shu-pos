/** Return the browser-facing origin when a request passed through Netlify. */
export function requestOrigin(request: {
  headers: Pick<Headers, "get">;
  nextUrl: { host: string; protocol: string };
}): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
  return `${protocol}://${host}`;
}
