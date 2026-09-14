import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import JournalEntry from "@/models/accounting/JournalEntry";
import {
  postJournalEntry, reverseJournalEntry, AccountingError,
  validateJournalLines, loadPostingAccounts, assertOpenPeriod,
} from "@/lib/accounting/engine";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  await connectDB();

  // ?attachment=1 → stream the supporting document
  const { searchParams } = new URL(request.url);
  if (searchParams.get("attachment") === "1") {
    const e = await JournalEntry.findById(id).select("+attachment").lean();
    if (!e?.attachment?.dataBase64) {
      return NextResponse.json({ message: "No attachment." }, { status: 404 });
    }
    return new NextResponse(Buffer.from(e.attachment.dataBase64, "base64"), {
      headers: {
        "Content-Type": e.attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${e.attachment.name || "document"}"`,
      },
    });
  }

  const e = await JournalEntry.findById(id).lean();
  if (!e) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return NextResponse.json({ entry: { ...e, id: e._id.toString() } });
}

/**
 * PATCH supports:
 *  - action: "post"    — post a Draft entry
 *  - action: "reverse" — reverse a Posted entry (creates opposite entry)
 *  - action: "cancel"  — cancel a Draft entry
 *  - otherwise: edit a Draft entry (date, description, reference, lines)
 * Posted entries are immutable.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  try {
    await connectDB();
    const body = await request.json();

    if (body.action === "post") {
      const entry = await postJournalEntry(id, authed.name);
      await logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: entry.jvNumber, detail: "Posted" });
      return NextResponse.json({ entry });
    }
    if (body.action === "reverse") {
      const reversal = await reverseJournalEntry(id, authed.name, body.reason);
      await logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: reversal.jvNumber, detail: "Reversal created" });
      return NextResponse.json({ entry: reversal });
    }
    if (body.action === "cancel") {
      const entry = await JournalEntry.findById(id);
      if (!entry) return NextResponse.json({ message: "Not found." }, { status: 404 });
      if (entry.status !== "Draft") throw new AccountingError("Only Draft entries can be cancelled.");
      entry.status = "Cancelled";
      await entry.save();
      await logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: entry.jvNumber, detail: "Cancelled" });
      return NextResponse.json({ entry });
    }

    // Edit draft
    const entry = await JournalEntry.findById(id);
    if (!entry) return NextResponse.json({ message: "Not found." }, { status: 404 });
    if (entry.status !== "Draft")
      throw new AccountingError("Posted entries are immutable — use Reverse instead.");

    // Draft edits obey the same rules as creating an entry. They used to skip
    // them, so a draft could be moved into a locked period or given a line
    // with both a debit and a credit, and then posted.
    if ("date" in body) {
      const d = new Date(body.date);
      if (Number.isNaN(d.getTime())) throw new AccountingError("Entry date is not a valid date.");
      await assertOpenPeriod(d, "date a draft in");
      entry.date = d;
    }
    if ("description" in body) entry.description = String(body.description).trim();
    if ("reference" in body) entry.reference = String(body.reference).trim() || undefined;

    if ("lines" in body) {
      const { lines, totalDebit, totalCredit } = validateJournalLines(body.lines);
      const byCode = await loadPostingAccounts(lines.map((l) => l.accountCode));
      entry.lines = lines.map((l) => ({ ...l, accountName: byCode.get(l.accountCode)!.name })) as never;
      entry.totalDebit = totalDebit;
      entry.totalCredit = totalCredit;
    }

    await entry.save();
    await logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: entry.jvNumber, detail: `Draft edited · AED ${entry.totalDebit}` });
    return NextResponse.json({ entry });
  } catch (error) {
    const status = error instanceof AccountingError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Failed to update entry.";
    return NextResponse.json({ message }, { status });
  }
}
