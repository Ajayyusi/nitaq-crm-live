import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: Request) {
  const authed = await requireAuth(["admin", "manager", "sales", "finance", "trainer"]);
  if (authed instanceof NextResponse) return authed;

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "Both current and new passwords are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ message: "New password must be at least 8 characters." }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(authed.id).select("+password");
  if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

  const match = await bcrypt.compare(currentPassword, user.password as string);
  if (!match) return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  return NextResponse.json({ message: "Password changed successfully." });
}
