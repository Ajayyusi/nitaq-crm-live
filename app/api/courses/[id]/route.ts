import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Course from "@/models/Course";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const course = await Course.findById(id).lean();
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ course });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userRole = (session.user as any).role;
    if (!["super_admin", "admin"].includes(userRole))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await connectDB();
    const body = await req.json();
    const course = await Course.findByIdAndUpdate(id, { ...body, updatedBy: (session.user as any).id }, { new: true });
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ course });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userRole = (session.user as any).role;
    if (!["super_admin", "admin"].includes(userRole))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await connectDB();
    await Course.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
