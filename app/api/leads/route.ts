import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const courseId = searchParams.get("courseId");

    const query: any = {};
    if (status) query.status = status;
    if (courseId) query.courseId = courseId;
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { studentPhone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Sales users only see their own leads
    const userRole = (session.user as any).role;
    if (userRole === "sales") {
      query.assignedSalesUser = (session.user as any).id;
    }

    const skip = (page - 1) * limit;
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate("courseId", "name category")
        .populate("subjectId", "name")
        .populate("assignedSalesUser", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
    ]);

    return NextResponse.json({
      leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await req.json();

    const lead = await Lead.create({
      ...body,
      assignedSalesUser: body.assignedSalesUser || (session.user as any).id,
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/leads error:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
