import { NextRequest } from "next/server";
import { proxyGoGET, proxyGoMutation } from "@/shared/lib/api/go-proxy";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyGoGET(request, `/${path.map(encodeURIComponent).join("/")}`);
}
async function mutate(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyGoMutation(request, `/${path.map(encodeURIComponent).join("/")}`);
}
export { mutate as POST, mutate as PATCH, mutate as PUT, mutate as DELETE };
