import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import JournalEntry from "@/models/accounting/JournalEntry";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { postJournalEntry, reverseJournalEntry, AccountingError } from "@/lib/accounting/engine";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };
const round2 = (n: number) => Math.round(n * 100) / 100;

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
      logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: entry.jvNumber, detail: "Posted" });
      return NextResponse.json({ entry });
    }
    if (body.action === "reverse") {
      const reversal = await reverseJournalEntry(id, authed.name, body.reason);
      logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: reversal.jvNumber, detail: "Reversal created" });
      return NextResponse.json({ entry: reversal });
    }
    if (body.action === "cancel") {
      const entry = await JournalEntry.findById(id);
      if (!entry) return NextResponse.json({ message: "Not found." }, { status: 404 });
      if (entry.status !== "Draft") throw new AccountingError("Only Draft entries can be cancelled.");
      entry.status = "Cancelled";
      await entry.save();
      logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "JournalEntry", entityId: id, entityLabel: entry.jvNumber, detail: "Cancelled" });
      return NextResponse.json({ entry });
    }

    // Edit draft
    const entry = await JournalEntry.findById(id);
    if (!entry) return NextResponse.json({ message: "Not found." }, { status: 404 });
    if (entry.status !== "Draft")
      throw new AccountingError("Posted entries are immutable — use Reverse instead.");

    if ("date" in body) entry.date = new Date(body.date);
    if ("description" in body) entry.description = String(body.description).trim();
    if ("reference" in body) entry.reference = String(body.reference).trim() || undefined;

    if ("lines" in body && Array.isArray(body.lines)) {
      let totalDebit = 0, totalCredit = 0;
      const codes = [...new Set(body.lines.map((l: { accountCode: string }) => String(l.accountCode).trim()))];
      const accounts = await ChartOfAccount.find({ code: { $in: codes } }).lean();
      const byCode = new Map(accounts.map((a) => [a.code, a]));
      const lines = [];
      for (const l of body.lines) {
        const code = String(l.accountCode).trim();
        const acc = byCode.get(code);
        if (!acc) throw new AccountingError(`Account ${code} not found.`);
        if (!acc.isPosting) throw new AccountingError(`Account ${code} is a parent account.`);
        const debit = round2(Number(l.debit) || 0);
        const credit = round2(Number(l.credit) || 0);
        totalDebit = round2(totalDebit + debit);
        totalCredit = round2(totalCredit + credit);
        lines.push({
          accountCode: code, accountName: acc.name, debit, credit,
          description: String(l.description ?? "").trim() || undefined,
          studentRef: l.studentRef || undefined,
          supplierRef: l.supplierRef || undefined,
          courseRef: l.courseRef || undefined,
        });
      }
      entry.lines = lines as never;
      entry.totalDebit = totalDebit;
      entry.totalCredit = totalCredit;
    }

    await entry.save();
    return NextResponse.json({ entry });
  } catch (error) {
    const status = error instanceof AccountingError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Failed to update entry.";
    return NextResponse.json({ message }, { status });
  }
}
