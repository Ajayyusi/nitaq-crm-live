import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import connectDB from "@/lib/db";
import User from "@/models/User";

/**
 * POST /api/admin/migrate-roles
 *
 * One-time migration: converts legacy "staff" role to "sales".
 * Safe to call multiple times — no-op if no "staff" users remain.
 * Requires admin session.
 */
export async function POST() {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();

    const result = await User.updateMany(
      { role: "staff" },
      { $set: { role: "sales" } }
    );

    return NextResponse.json({
      migrated: result.modifiedCount,
      message: result.modifiedCount > 0
        ? `${result.modifiedCount} user(s) migrated from "staff" → "sales".`
        : 'No legacy "staff" users found. Nothing to migrate.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Migration failed." },
      { status: 500 }
    );
  }
}
