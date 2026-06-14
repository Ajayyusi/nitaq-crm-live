import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";

// POST /api/admin/create-super-admin
// Creates or resets the super admin account (admin only)
export async function POST() {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();

  const email = "superadmin@nitaqacademy.com";
  const password = "NitaqAdmin@2026";
  const name = "Super Admin";

  const hashed = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });

  if (existing) {
    // Reset to admin + ensure active
    await User.updateOne({ email }, { role: "admin", active: true, password: hashed, name });
    return NextResponse.json({
      message: "Super admin account reset.",
      email,
      password,
      note: "Password has been reset. Change it after first login.",
    });
  }

  await User.create({ name, email, password: hashed, role: "admin", active: true });
  return NextResponse.json({
    message: "Super admin account created.",
    email,
    password,
    note: "Save these credentials. You will not see the password again in this form.",
  }, { status: 201 });
}
