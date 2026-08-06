import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Teacher from "@/models/Teacher";
import ClassSession from "@/models/ClassSession";
import TeacherPayout from "@/models/TeacherPayout";
import { getNextSequence } from "@/models/Counter";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { createJournalEntry } from "@/lib/accounting/engine";
import { previewTeacherPayout } from "@/lib/payroll";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/** What each active teacher is currently owed, plus recent settlements. */
export async function GET() {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const [teachers, recent, settings] = await Promise.all([
    Teacher.find({ status: "Active" }).sort({ fullName: 1 }).lean(),
    TeacherPayout.find({}).sort({ paidDate: -1, createdAt: -1 }).limit(50).lean(),
    getAccountingSettings(),
  ]);

  const due = [];
  for (const t of teachers) {
    const preview = await previewTeacherPayout(t as never);
    // Only surface teachers with something to settle. A zero-amount batch is
    // still shown when sessions are outstanding (e.g. a fixed course fee that
    // was already paid) so the admin can see why nothing is owed.
    if (preview.sessionCount === 0 && preview.basis !== "Monthly") continue;
    due.push({
      teacherId: t._id.toString(),
      teacherName: t.fullName,
      paymentType: t.paymentType ?? "",
      ...preview,
    });
  }
  due.sort((a, b) => b.suggestedAmount - a.suggestedAmount);

  return NextResponse.json({
    due,
    totalDue: Math.round(due.reduce((s, d) => s + d.suggestedAmount, 0) * 100) / 100,
    payouts: recent.map((p) => ({
      id: p._id.toString(),
      payoutNumber: p.payoutNumber,
      teacherName: p.teacherName,
      basis: p.basis,
      quantity: p.quantity,
      sessionCount: p.sessionCount,
      totalHours: p.totalHours,
      amount: p.amount,
      paidDate: p.paidDate?.toISOString().slice(0, 10) ?? "",
      journalEntryId: p.journalEntryId?.toString() ?? "",
      createdBy: p.createdBy,
    })),
    defaults: {
      expenseAccountCode: settings.teacherSalaryAccount || settings.defaultExpenseAccount,
      paymentAccountCode: settings.defaultCashAccount,
    },
  });
}

/**
 * Mark a teacher paid: snapshots the unpaid sessions, stamps them so they
 * can never be paid twice, and posts Dr Salaries / Cr Cash-Bank.
 */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const teacherId = String(body.teacherId ?? "");
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return NextResponse.json({ message: "Valid teacher is required." }, { status: 400 });
    }
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return NextResponse.json({ message: "Teacher not found." }, { status: 404 });

    // Recompute server-side — never trust an amount/session list from the client
    const preview = await previewTeacherPayout(teacher as never);
    const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
    if (amount <= 0) return NextResponse.json({ message: "Amount must be greater than zero." }, { status: 400 });
    if (preview.sessionCount === 0 && preview.basis !== "Monthly") {
      return NextResponse.json({ message: "This trainer has no unsettled sessions." }, { status: 400 });
    }

    const adjusted = Math.abs(amount - preview.suggestedAmount) > 0.009;
    const adjustmentReason = String(body.adjustmentReason ?? "").trim();
    if (adjusted && adjustmentReason.length < 3) {
      return NextResponse.json(
        { message: `Amount differs from the calculated ${preview.suggestedAmount.toFixed(2)} — a reason is required.` },
        { status: 400 }
      );
    }

    const settings = await getAccountingSettings();
    const expenseAccountCode = String(body.expenseAccountCode ?? "").trim()
      || settings.teacherSalaryAccount || settings.defaultExpenseAccount;
    const paymentAccountCode = String(body.paymentAccountCode ?? "").trim() || settings.defaultCashAccount;
    if (!expenseAccountCode || !paymentAccountCode) {
      return NextResponse.json({ message: "Set the salary and payment accounts in Accounting Settings first." }, { status: 400 });
    }

    const seq = await getNextSequence("teacher-payout");
    const payoutNumber = `TP-${String(seq).padStart(4, "0")}`;
    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();

    const payout = await TeacherPayout.create({
      payoutNumber,
      teacherId: teacher._id,
      teacherName: teacher.fullName,
      sessionIds: preview.sessionIds,
      periodFrom: preview.periodFrom ? new Date(preview.periodFrom) : undefined,
      periodTo: preview.periodTo ? new Date(preview.periodTo) : undefined,
      basis: preview.basis,
      rate: preview.rate,
      quantity: preview.quantity,
      // Snapshot the per-registration breakdown so a payout stays auditable
      // even after a registration's rate is later changed.
      lines: preview.lines.length
        ? preview.lines.map((l) => ({
            enrollmentRef: l.enrollmentRef,
            studentName: l.studentName,
            course: l.course,
            basis: l.basis,
            rate: l.rate,
            quantity: l.quantity,
            sessionCount: l.sessionCount,
            hours: l.hours,
            amount: l.amount,
            source: l.source,
          }))
        : undefined,
      sessionCount: preview.sessionCount,
      totalHours: preview.totalHours,
      suggestedAmount: preview.suggestedAmount,
      amount,
      adjustmentReason: adjusted ? adjustmentReason : undefined,
      paidDate,
      expenseAccountCode,
      paymentAccountCode,
      notes: String(body.notes ?? "").trim() || undefined,
      createdBy: authed.name,
    });

    // Stamp the sessions so they can never be included in another payout
    if (preview.sessionIds.length > 0) {
      await ClassSession.updateMany(
        { _id: { $in: preview.sessionIds } },
        { $set: { payoutId: payout._id } }
      );
    }

    // Post: Dr Salaries expense / Cr Cash or Bank
    try {
      const entry = await createJournalEntry({
        date: paidDate,
        sourceType: "Expense",
        sourceId: payout._id.toString(),
        sourceNumber: payoutNumber,
        description: `Teacher payment — ${teacher.fullName} (${preview.quantityLabel})`,
        reference: payoutNumber,
        lines: [
          { accountCode: expenseAccountCode, debit: amount, description: `${teacher.fullName} · ${preview.quantityLabel}` },
          { accountCode: paymentAccountCode, credit: amount, description: `Paid to ${teacher.fullName}` },
        ],
        createdBy: authed.name,
      });
      payout.journalEntryId = entry._id as never;
      await payout.save();
    } catch (postErr) {
      // Keep the payout (sessions are settled) but tell the admin the ledger failed
      const msg = postErr instanceof Error ? postErr.message : "posting failed";
      logAudit({
        userName: authed.name, userRole: authed.role,
        action: "created", entity: "TeacherPayout", entityId: payout._id.toString(),
        entityLabel: payoutNumber, detail: `Paid AED ${amount} — LEDGER POSTING FAILED: ${msg}`,
      });
      return NextResponse.json({
        payout: { id: payout._id.toString(), payoutNumber, amount },
        warning: `Payment recorded, but the accounting entry failed: ${msg}`,
      }, { status: 201 });
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "TeacherPayout",
      entityId: payout._id.toString(), entityLabel: `${payoutNumber} · ${teacher.fullName}`,
      detail: `AED ${amount} · ${preview.quantityLabel}${adjusted ? ` · adjusted: ${adjustmentReason}` : ""}`,
    });
    if (teacher.email) {
      notify({
        userEmail: teacher.email,
        title: `Payment recorded: AED ${amount.toLocaleString()}`,
        body: `${payoutNumber} · ${preview.quantityLabel} covered.`,
      });
    }

    return NextResponse.json({ payout: { id: payout._id.toString(), payoutNumber, amount } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
