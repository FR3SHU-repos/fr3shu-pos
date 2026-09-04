import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { mongoDB } from "@/shared/lib/db/mongo";
import { signToken, makeAuthCookie, type SellerOrgType } from "@/shared/lib/auth";
import { loginSchema } from "@/shared/schemas/auth";
import { success, failure } from "@/app/api/v1/utils/responses";
import UserModel from "@/shared/models/mongodb/identity/user";
import SellerOrganizationModel from "@/shared/models/mongodb/identity/sellerOrganization";

export async function POST(req: NextRequest) {
  try {
    await mongoDB();

    const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(failure("Invalid credentials payload"), { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    // Uniform response to avoid leaking which emails exist.
    if (!user || !user.isActive) {
      return NextResponse.json(failure("Invalid email or password"), { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(failure("Invalid email or password"), { status: 401 });
    }

    let orgType: SellerOrgType | "Platform" = "Platform";
    if (user.orgId) {
      const org = await SellerOrganizationModel.findById(user.orgId).lean();
      if (org) orgType = org.type;
    }

    const locationId = user.locationIds?.[0] ?? "";
    const token = signToken({
      sub: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId ?? "",
      orgType,
      locationId,
    });

    const res = NextResponse.json(
      success(
        {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          orgId: user.orgId ?? "",
          orgType,
          locationId,
        },
        "Welcome back",
      ),
    );
    res.cookies.set(makeAuthCookie(token));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    console.error("auth/login:", message);
    return NextResponse.json(failure("Login failed", message), { status: 500 });
  }
}
