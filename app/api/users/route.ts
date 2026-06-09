import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { userRoles } from "@/models/User";

const allowedRoles = new Set<string>(userRoles);

export async function GET() {
  try {
    await connectDB();
    const users = await User.find({}, { password: 0 }).sort({ role: 1, name: 1 }).lean();
    const serialized = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      lastLogin: u.lastLogin ? new Date(u.lastLogin).toISOString() : null,
      createdAt: new Date(u.createdAt).toISOString(),
    }));
    return NextResponse.json({ users: serialized });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();
    const role = String(body.role ?? "staff").trim();

    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!allowedRoles.has(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

    const existing = await User.findOne({ email });
    if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role, active: true });

    return NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, active: user.active },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
