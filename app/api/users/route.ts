import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// POST /api/users - create user (super_admin only, or initial seed)
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const users = await User.find().select("-password").lean();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { name, email, password, role, phone } = body;

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role, phone });
    const { password: _, ...userWithoutPassword } = user.toObject();

    return NextResponse.json({ user: userWithoutPassword }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
