import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { requireAuth } from "@/lib/api-auth";

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

  // Active only: exclude reversed originals (status Reversed) and their
  // reversal entries (sourceType Reversal) so statements show only live
  // invoices, receipts and outstanding balances.
  const sums = await JournalEntry.aggregate([
    { $match: { status: "Posted", sourceType: { $ne: "Reversal" }, "lines.accountCode": { $in: codes } } },
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
 * POST — formerly a "one-time migration" that rewrote the account code on
 * POSTED journal lines in place, matching students by name. Posted entries
 * are immutable: an in-place edit changes closed periods with no reversal,
 * and two students with the same name had all their lines moved to one
 * account. Reclassifications must be posted as dated journal vouchers.
 */
export async function POST() {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;
  return NextResponse.json(
    {
      message:
        "This migration has been retired: it edited posted journal lines in place. " +
        "Move balances between receivable accounts with a journal voucher instead.",
    },
    { status: 410 }
  );
}
