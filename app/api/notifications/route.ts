import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Notification from "@/models/Notification";
import { requireAuth } from "@/lib/api-auth";

/** My notifications: targeted at my email or my role. */
export async function GET() {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const items = await Notification.find({
    $or: [
      { userEmail: authed.email.toLowerCase() },
      { roleTarget: authed.role },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return NextResponse.json({
    notifications: items.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      body: n.body ?? "",
      link: n.link ?? "",
      read: n.read,
      createdAt: n.createdAt?.toISOString() ?? "",
    })),
    unread: items.filter((n) => !n.read).length,
  });
}

/** Mark my notifications read: { ids: [...] } or { all: true }. */
export async function PATCH(request: NextRequest) {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const body = await request.json();
  const target = {
    $or: [{ userEmail: authed.email.toLowerCase() }, { roleTarget: authed.role }],
  };
  if (body.all === true) {
    await Notification.updateMany(target, { $set: { read: true } });
  } else if (Array.isArray(body.ids)) {
    await Notification.updateMany({ ...target, _id: { $in: body.ids } }, { $set: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
