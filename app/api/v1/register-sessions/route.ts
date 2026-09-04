import { NextResponse, type NextRequest } from "next/server";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success } from "@/app/api/v1/utils/responses";
import { requireSession, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import PosRegisterModel from "@/shared/models/mongodb/pos/posRegister";
import PosSessionModel from "@/shared/models/mongodb/pos/posSession";

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    await mongoDB();

    const locScope = session.locationId ? { locationId: session.locationId } : {};
    const [registers, currentSession, recentSessions] = await Promise.all([
      PosRegisterModel.find({ ...tenantFilter(session), ...locScope, status: "active" })
        .sort({ name: 1 })
        .lean(),
      PosSessionModel.findOne({ ...tenantFilter(session), ...locScope, status: "open" })
        .sort({ openedAt: -1 })
        .lean(),
      PosSessionModel.find({ ...tenantFilter(session), ...locScope, status: "closed" })
        .sort({ closedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return NextResponse.json(success({ registers, currentSession, recentSessions }));
  } catch (err) {
    return toErrorResponse(err);
  }
}
