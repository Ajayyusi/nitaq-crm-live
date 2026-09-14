import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Teacher from "@/models/Teacher";
import TeacherPayout from "@/models/TeacherPayout";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { AccountingError } from "@/lib/accounting/engine";
import { previewTeacherPayout, settleTeacherPayout, PayrollError } from "@/lib/payroll";
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
      periodKey: p.periodKey ?? "",
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
 * Mark a teacher paid. The rules (server-side recalculation, validation before
 * any write, atomic session claim, rollback on posting failure, one salary per
 * month) live in settleTeacherPayout so they are testable without HTTP.
 */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const { payout, teacher, preview, amount, adjusted, adjustmentReason } = await settleTeacherPayout({
      teacherId: String(body.teacherId ?? ""),
      amount: body.amount,
      adjustmentReason: body.adjustmentReason,
      paidDate: body.paidDate,
      expenseAccountCode: body.expenseAccountCode,
      paymentAccountCode: body.paymentAccountCode,
      periodMonth: body.periodMonth,
      notes: body.notes,
      createdBy: authed.name,
    });

    await logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "TeacherPayout",
      entityId: payout._id.toString(), entityLabel: `${payout.payoutNumber} · ${teacher.fullName}`,
      detail: `AED ${amount} · ${payout.periodKey ? `salary ${payout.periodKey}` : preview.quantityLabel}${adjusted ? ` · adjusted: ${adjustmentReason}` : ""}`,
    });
    if (teacher.email) {
      notify({
        userEmail: teacher.email,
        title: `Payment recorded: AED ${amount.toLocaleString()}`,
        body: `${payout.payoutNumber} · ${preview.quantityLabel} covered.`,
      });
    }

    return NextResponse.json(
      { payout: { id: payout._id.toString(), payoutNumber: payout.payoutNumber, amount } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof AccountingError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("[teacher-payouts] POST failed:", error);
    return NextResponse.json({ message: "Failed to record payment." }, { status: 500 });
  }
}
