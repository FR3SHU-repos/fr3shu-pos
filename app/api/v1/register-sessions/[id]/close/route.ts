import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import { closeRegisterSchema } from "@/shared/schemas/register";
import { computeClose } from "@/shared/services/registers";
import PosSessionModel from "@/shared/models/mongodb/pos/posSession";
import AuditLogModel from "@/shared/models/mongodb/audit/auditLog";

type Ctx = { params: Promise<{ id: string }> };

const thresholdPaise = () =>
  Number(process.env.POS_CASH_VARIANCE_NOTE_THRESHOLD_PAISE ?? 20000);

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Cashier", "Manager", "Owner", "Admin"]);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(failure("Invalid id"), { status: 400 });
    }
    await mongoDB();

    const parsed = closeRegisterSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid payload", parsed.error.message), { status: 400 });
    }

    const posSession = await PosSessionModel.findOne({
      _id: id,
      ...tenantFilter(session),
      status: "open",
    });
    if (!posSession) {
      return NextResponse.json(failure("Open session not found"), { status: 404 });
    }

    const result = computeClose({
      openingCashPaise: posSession.openingCashPaise,
      totals: posSession.totals,
      countedCashPaise: parsed.data.countedCashPaise,
      varianceNoteThresholdPaise: thresholdPaise(),
    });

    if (result.noteRequired && !parsed.data.varianceNote?.trim()) {
      return NextResponse.json(
        failure(
          `Cash variance of ${result.cashVariancePaise} paise exceeds the threshold — a note is required`,
        ),
        { status: 400 },
      );
    }

    posSession.status = "closed";
    posSession.closedBy = session.sub;
    posSession.closedAt = new Date();
    posSession.expectedCashPaise = result.expectedCashPaise;
    posSession.countedCashPaise = parsed.data.countedCashPaise;
    posSession.cashVariancePaise = result.cashVariancePaise;
    posSession.varianceNote = parsed.data.varianceNote?.trim();
    await posSession.save();

    AuditLogModel.create({
      actorId: session.sub,
      orgId: session.orgId,
      locationId: posSession.locationId,
      action: "register.close",
      entity: "PosSession",
      entityId: String(posSession._id),
      after: {
        expectedCashPaise: result.expectedCashPaise,
        countedCashPaise: parsed.data.countedCashPaise,
        cashVariancePaise: result.cashVariancePaise,
      },
    }).catch(() => {});

    return NextResponse.json(success(posSession.toObject(), "Register session closed"));
  } catch (err) {
    return toErrorResponse(err);
  }
}
