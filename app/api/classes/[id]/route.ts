import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Class from "@/models/Class";
import { auth } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const cls = await Class.findById(id).populate("teacherId", "fullName").populate("studentId", "fullName").lean();
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ class: cls });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const cls = await Class.findByIdAndUpdate(id, body, { new: true });
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ class: cls });
  } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}
