import { NextResponse, type NextRequest } from "next/server";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, toErrorResponse } from "@/app/api/v1/utils/guard";
import { openRegisterSchema } from "@/shared/schemas/register";
import { EMPTY_TOTALS } from "@/shared/services/registers";
import PosRegisterModel from "@/shared/models/mongodb/pos/posRegister";
import PosSessionModel from "@/shared/models/mongodb/pos/posSession";
import AuditLogModel from "@/shared/models/mongodb/audit/auditLog";

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Cashier", "Manager", "Owner", "Admin"]);
    await mongoDB();

    const parsed = openRegisterSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid payload", parsed.error.message), { status: 400 });
    }
    const { registerId, openingCashPaise } = parsed.data;

    const register = await PosRegisterModel.findOne({
      _id: registerId,
      orgId: session.orgId,
      status: "active",
    }).lean();
    if (!register) return NextResponse.json(failure("Register not found"), { status: 404 });
    if (session.locationId && String(register.locationId) !== session.locationId) {
      return NextResponse.json(failure("Register is not at your assigned location"), { status: 403 });
    }

    const alreadyOpen = await PosSessionModel.findOne({ registerId, status: "open" }).lean();
    if (alreadyOpen) {
      return NextResponse.json(failure("This register already has an open session"), { status: 409 });
    }

    let created;
    try {
      created = await PosSessionModel.create({
        orgId: session.orgId,
        locationId: String(register.locationId),
        registerId,
        openedBy: session.sub,
        openedAt: new Date(),
        openingCashPaise,
        status: "open",
        totals: { ...EMPTY_TOTALS },
      });
    } catch (e) {
      // Partial unique index on { registerId, status: "open" } lost the race.
      if ((e as { code?: number }).code === 11000) {
        return NextResponse.json(failure("This register already has an open session"), {
          status: 409,
        });
      }
      throw e;
    }

    AuditLogModel.create({
      actorId: session.sub,
      orgId: session.orgId,
      locationId: String(register.locationId),
      action: "register.open",
      entity: "PosSession",
      entityId: String(created._id),
      after: { registerId, openingCashPaise },
    }).catch(() => {});

    return NextResponse.json(success(created, "Register session opened"), { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
