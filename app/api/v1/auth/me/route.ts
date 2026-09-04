import { NextRequest } from "next/server";
import { proxyGoGET } from "@/shared/lib/api/go-proxy";

/** @deprecated Compatibility route; Go owns POS staff authentication. */
export function GET(request: NextRequest) {
  return proxyGoGET(request, "/pos/auth/me");
}
