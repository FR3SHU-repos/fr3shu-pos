import { NextResponse, type NextRequest } from "next/server";
import { mongoDB } from "@/shared/lib/db/mongo";
import { getSessionFromRequest } from "@/shared/lib/auth";
import { success, failure } from "@/app/api/v1/utils/responses";
import UserModel from "@/shared/models/mongodb/identity/user";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json(failure("Unauthorized"), { status: 401 });

  try {
    await mongoDB();
    const user = await UserModel.findById(session.sub).select("-passwordHash").lean();
    if (!user || !user.isActive) {
      return NextResponse.json(failure("Account not found or inactive"), { status: 401 });
    }
    return NextResponse.json(
      success({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: session.orgId,
        orgType: session.orgType,
        locationId: session.locationId,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json(failure("Failed to load session", message), { status: 500 });
  }
}
