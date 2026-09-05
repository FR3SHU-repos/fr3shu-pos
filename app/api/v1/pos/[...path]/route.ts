import { NextRequest } from "next/server";
import { proxyGoGET, proxyGoMutation } from "@/shared/lib/api/go-proxy";

// migration-audit:new-route
//
// Same-origin, database-free proxy for the canonical POS API in go-api-backend.
// The browser calls `/api/v1/pos/*` here; this relays to `<GO>/api/v1/pos/*`
// with the caller's cookies and forwards any `Set-Cookie` back (POS login sets
// an httpOnly `pos_token` cookie). There is no MongoDB access anywhere in the
// POS web runtime — Go owns every read and write.

async function target(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<string> {
  const { path } = await ctx.params;
  return `/pos/${(path ?? []).join("/")}`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyGoGET(req, await target(req, ctx));
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyGoMutation(req, await target(req, ctx));
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyGoMutation(req, await target(req, ctx));
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyGoMutation(req, await target(req, ctx));
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyGoMutation(req, await target(req, ctx));
}
