import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/shared/lib/auth";
import { success } from "@/app/api/v1/utils/responses";

export async function POST() {
  const res = NextResponse.json(success(null, "Logged out"));
  res.cookies.set(clearAuthCookie());
  return res;
}
