import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import Enrollment from "@/models/Enrollment";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { ensureStudentArAccount } from "@/lib/accounting/postings";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Per-student receivable balances (from posted journal entries). */
export async function GET() {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const settings = await getAccountingSettings();

  // All accounts under ACCOUNTS RECEIVABLES (incl. the legacy control account)
  const arAccounts = await ChartOfAccount.find({ parentCode: "10103" }).sort({ name: 1 }).lean();
  const codes = arAccounts.map((a) => a.code);

  const sums = await JournalEntry.aggregate([
    { $match: { status: { $in: ["Posted", "Reversed"] }, "lines.accountCode": { $in: codes } } },
    { $unwind: "$lines" },
    { $match: { "lines.accountCode": { $in: codes } } },
    { $group: { _id: "$lines.accountCode", invoiced: { $sum: "$lines.debit" }, paid: { $sum: "$lines.credit" } } },
  ]);
  const sumMap = new Map(sums.map((s) => [s._id as string, s]));

  const students = arAccounts
    .map((a) => {
      const s = sumMap.get(a.code);
      const invoiced = round2(s?.invoiced ?? 0);
      const paid = round2(s?.paid ?? 0);
      return {
        code: a.code,
        name: a.name,
        isControl: a.code === settings.accountsReceivable,
        invoiced,
        paid,
        balance: round2(invoiced - paid + (a.openingDebit ?? 0) - (a.openingCredit ?? 0)),
      };
    })
    .filter((r) => r.invoiced || r.paid || r.balance || !r.isControl);

  const totals = {
    invoiced: round2(students.reduce((t, r) => t + r.invoiced, 0)),
    paid: round2(students.reduce((t, r) => t + r.paid, 0)),
    balance: round2(students.reduce((t, r) => t + r.balance, 0)),
  };

  return NextResponse.json({ students, totals, controlAccount: settings.accountsReceivable });
}

/**
 * POST — one-time migration: move historical journal lines sitting on the
 * "Student-1" control account onto each student's own A/R account (matched
 * by the student name stamped on the line). Idempotent.
 */
export async function POST() {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const settings = await getAccountingSettings();
  const control = settings.accountsReceivable;

  // Ensure every enrollment has its own A/R account, build name → account map
  const enrollments = await Enrollment.find({}).select("fullName arAccountCode").lean();
  const byName = new Map<string, string>();
  for (const e of enrollments) {
    const code = e.arAccountCode ?? (await ensureStudentArAccount(e._id.toString()));
    if (code && !byName.has(e.fullName.toLowerCase())) byName.set(e.fullName.toLowerCase(), code);
  }
  const accountNames = new Map(
    (await ChartOfAccount.find({ parentCode: "10103" }).select("code name").lean()).map((a) => [a.code, a.name])
  );

  // Re-point control-account lines that carry a matching studentRef
  const entries = await JournalEntry.find({ "lines.accountCode": control }).select("lines");
  let moved = 0;
  for (const entry of entries) {
    let changed = false;
    for (const line of entry.lines) {
      if (line.accountCode !== control || !line.studentRef) continue;
      const code = byName.get(line.studentRef.toLowerCase());
      if (!code) continue;
      line.accountCode = code;
      line.accountName = accountNames.get(code) ?? line.studentRef;
      changed = true;
      moved++;
    }
    if (changed) { entry.markModified("lines"); await entry.save(); }
  }

  logAudit({
    userName: authed.name, userRole: authed.role,
    action: "updated", entity: "JournalEntry", entityId: "ar-migration",
    entityLabel: "Student A/R migration", detail: `${moved} lines moved to per-student accounts`,
  });

  return NextResponse.json({ message: `${moved} ledger line${moved !== 1 ? "s" : ""} moved from the control account to per-student accounts.`, moved });
}
