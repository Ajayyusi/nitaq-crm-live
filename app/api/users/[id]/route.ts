import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { userRoles } from "@/models/User";
import mongoose from "mongoose";

const allowedRoles = new Set<string>(userRoles);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.role !== undefined) {
      const role = String(body.role).trim();
      if (!allowedRoles.has(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      updates.role = role;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.newPassword !== undefined && body.newPassword !== "") {
      const pw = String(body.newPassword).trim();
      if (pw.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      updates.password = await bcrypt.hash(pw, 12);
    }

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, select: "-password" });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    return NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, active: user.active },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findByIdAndDelete(id);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
