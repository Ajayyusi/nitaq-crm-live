import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { userRoles } from "@/models/User";
import bcrypt from "bcryptjs";

const allowedRoles = new Set<string>(userRoles);

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role")?.trim();

    // Non-admins can only query role-filtered lists (e.g. ?role=sales for
    // assignment dropdowns) and never privileged roles.
    const filter: Record<string, unknown> = {};
    if (roleFilter) {
      if (!allowedRoles.has(roleFilter)) {
        return NextResponse.json({ error: "Invalid role filter." }, { status: 400 });
      }
      if (authed.role !== "admin" && (roleFilter === "admin" || roleFilter === "manager")) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      filter.role = roleFilter;
    } else if (authed.role !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const users = await User.find(filter, { password: 0 }).sort({ role: 1, name: 1 }).lean();
    const serialized = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      mobileNumber: u.mobileNumber ?? "",
      lastLogin: u.lastLogin ? new Date(u.lastLogin).toISOString() : null,
      createdAt: new Date(u.createdAt).toISOString(),
    }));
    return NextResponse.json({ users: serialized });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const name         = String(body.name ?? "").trim();
    const email        = String(body.email ?? "").trim().toLowerCase();
    const password     = String(body.password ?? "").trim();
    const role         = String(body.role ?? "sales").trim();
    const mobileNumber = String(body.mobileNumber ?? "").trim();

    if (!name)                             return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email)                            return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!allowedRoles.has(role))          return NextResponse.json({ error: "Invalid role." }, { status: 400 });

    const existing = await User.findOne({ email });
    if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role, active: true, mobileNumber: mobileNumber || undefined });

    return NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, active: user.active, mobileNumber: user.mobileNumber ?? "" },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
