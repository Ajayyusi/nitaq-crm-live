import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import JournalEntry from "@/models/accounting/JournalEntry";
import { createJournalEntry, AccountingError } from "@/lib/accounting/engine";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { buildDateFilter } from "@/lib/dateRange";

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sourceType = searchParams.get("sourceType");
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (sourceType) query.sourceType = sourceType;
  const dateFilter = buildDateFilter(from, to);
  if (dateFilter) query.date = dateFilter;

  const entries = await JournalEntry.find(query)
    .select("+attachment.name") // list only needs the file name, not the data
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e._id.toString(),
      attachmentName: e.attachment?.name ?? "",
      jvNumber: e.jvNumber,
      date: e.date.toISOString().slice(0, 10),
      description: e.description,
      reference: e.reference ?? "",
      sourceType: e.sourceType,
      sourceId: e.sourceId ?? "",
      sourceNumber: e.sourceNumber ?? "",
      status: e.status,
      totalDebit: e.totalDebit,
      totalCredit: e.totalCredit,
      lines: e.lines,
      createdBy: e.createdBy,
      postedBy: e.postedBy ?? "",
      postedAt: e.postedAt?.toISOString() ?? "",
      reversedByEntryId: e.reversedByEntryId?.toString() ?? "",
      reversesEntryId: e.reversesEntryId?.toString() ?? "",
      createdAt: e.createdAt?.toISOString() ?? "",
    })),
  });
}

/** Create a manual Journal Voucher (Draft by default, Posted if post=true). */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const entry = await createJournalEntry({
      date: body.date || new Date(),
      sourceType: body.mode === "receipt" ? "Receipt" : body.mode === "invoice" ? "Invoice" : "JV",
      description: String(body.description ?? "").trim() || "Manual journal voucher",
      reference: String(body.reference ?? "").trim() || undefined,
      lines: Array.isArray(body.lines) ? body.lines : [],
      createdBy: authed.name,
      autoPost: body.post === true,
    });

    // Optional supporting document (≤1MB)
    if (body.attachment?.dataBase64 && typeof body.attachment.dataBase64 === "string") {
      if (body.attachment.dataBase64.length > 1_500_000) {
        return NextResponse.json({ message: "Attachment too large — maximum 1 MB." }, { status: 400 });
      }
      await JournalEntry.updateOne(
        { _id: entry._id },
        { $set: { attachment: {
          name: String(body.attachment.name ?? "document").slice(0, 200),
          mimeType: String(body.attachment.mimeType ?? "application/octet-stream").slice(0, 100),
          dataBase64: body.attachment.dataBase64,
        } } }
      );
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "JournalEntry",
      entityId: entry._id.toString(), entityLabel: entry.jvNumber,
      detail: `${entry.status} · AED ${entry.totalDebit}`,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const status = error instanceof AccountingError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Failed to create journal entry.";
    return NextResponse.json({ message }, { status });
  }
}
