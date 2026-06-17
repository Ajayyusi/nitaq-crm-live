import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();

  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user")?.trim();
  const entity = searchParams.get("entity")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

  const query: Record<string, unknown> = {};
  if (user) query.userName = new RegExp(`^${user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (entity && entity !== "all") query.entity = entity;

  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ logs });
}
