import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mongoDB } from "@/shared/lib/db/mongo";
import { success, failure } from "@/app/api/v1/utils/responses";
import { requireSession, requireRole, tenantFilter, toErrorResponse } from "@/app/api/v1/utils/guard";
import CategoryModel from "@/shared/models/mongodb/catalog/category";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  sortOrder: z.number().int().min(0).optional(),
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(req: NextRequest) {
  try {
    const session = requireSession(req);
    await mongoDB();
    const items = await CategoryModel.find({ ...tenantFilter(session), isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return NextResponse.json(success({ items }));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    requireRole(session, ["Owner", "Manager", "Admin"]);
    await mongoDB();

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid category", parsed.error.message), { status: 400 });
    }

    const slug = slugify(parsed.data.name);
    const existing = await CategoryModel.findOne({ orgId: session.orgId, slug });
    if (existing) {
      return NextResponse.json(failure("A category with that name already exists"), { status: 409 });
    }

    const category = await CategoryModel.create({
      orgId: session.orgId,
      name: parsed.data.name.trim(),
      slug,
      sortOrder: parsed.data.sortOrder ?? 0,
      isActive: true,
    });
    return NextResponse.json(success(category, "Category created"), { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
