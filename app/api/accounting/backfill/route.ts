import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import { postStudentInvoice, postCustomerReceipt, postExpensePaid } from "@/lib/accounting/postings";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

/**
 * One-time (idempotent) backfill: generates journal entries for all existing
 * CRM enrollments (invoices), payments (receipts) and expenses that don't
 * have an entry yet. The engine's duplicate-source guard means running this
 * repeatedly never double-posts.
 */
export async function POST() {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();

  const coaCount = await ChartOfAccount.countDocuments();
  if (coaCount === 0) {
    return NextResponse.json(
      { message: "Chart of Accounts is empty — seed it first from the Accounting dashboard." },
      { status: 400 }
    );
  }

  // Pre-load existing entry source ids to skip cheaply
  const existing = await JournalEntry.find({ sourceId: { $type: "string" } }).select("sourceType sourceId").lean();
  const have = new Set(existing.map((e) => `${e.sourceType}:${e.sourceId}`));

  let invoices = 0, receipts = 0, expenses = 0, failed = 0;

  // 1. Enrollments → invoice entries (Dr A/R / Cr Revenue)
  const enrollments = await Enrollment.find({ totalFee: { $gt: 0 } }).lean();
  for (const e of enrollments) {
    const id = e._id.toString();
    if (have.has(`Invoice:${id}`)) continue;
    try {
      await postStudentInvoice({
        sourceId: id,
        sourceNumber: e.enrollmentId ?? id,
        date: e.registrationDate ?? e.createdAt ?? new Date(),
        studentName: e.fullName,
        course: e.course ?? "",
        totalFee: e.totalFee ?? 0,
        createdBy: `${authed.name} (backfill)`,
      });
      invoices++;
    } catch { failed++; }
  }

  // 2. Payments (Received) → receipt entries (Dr money / Cr A/R)
  const payments = await Payment.find({ status: "Received", amount: { $gt: 0 } }).lean();
  for (const p of payments) {
    const id = p._id.toString();
    if (have.has(`Receipt:${id}`)) continue;
    try {
      const entry = await postCustomerReceipt({
        sourceId: id,
        sourceNumber: p.paymentId ?? id,
        date: p.datePaid ?? p.createdAt ?? new Date(),
        studentName: p.studentName,
        course: p.course,
        amount: p.amount,
        paymentMethod: p.paymentMethod ?? "Cash",
        asAdvance: !p.enrollmentId,
        enrollmentId: p.enrollmentId?.toString(),
        createdBy: `${authed.name} (backfill)`,
      });
      if (entry) await Payment.updateOne({ _id: p._id }, { $set: { journalEntryId: entry._id } });
      receipts++;
    } catch { failed++; }
  }

  // 3. Expenses → expense entries (Dr expense / Cr money)
  const allExpenses = await Expense.find({ amount: { $gt: 0 } }).lean();
  for (const x of allExpenses) {
    const id = x._id.toString();
    if (have.has(`Expense:${id}`)) continue;
    try {
      const vatAmount = x.vatAmount ?? 0;
      const net = x.amountBeforeVAT ?? Math.round(((x.amount ?? 0) - vatAmount) * 100) / 100;
      const entry = await postExpensePaid({
        sourceId: id,
        sourceNumber: x.expenseId ?? id,
        date: x.expenseDate ?? x.createdAt ?? new Date(),
        expenseAccountCode: x.expenseAccountCode,
        category: x.category ?? "Other",
        description: x.description ?? x.payee ?? "",
        amountBeforeVAT: net,
        vatAmount,
        paymentMethod: x.paymentMethod ?? "Cash",
        createdBy: `${authed.name} (backfill)`,
      });
      if (entry) await Expense.updateOne({ _id: x._id }, { $set: { journalEntryId: entry._id } });
      expenses++;
    } catch { failed++; }
  }

  const message = `Backfill complete: ${invoices} invoices, ${receipts} receipts, ${expenses} expenses posted${failed ? `, ${failed} skipped (already posted or invalid)` : ""}.`;

  logAudit({
    userName: authed.name, userRole: authed.role,
    action: "created", entity: "JournalEntry", entityId: "backfill",
    entityLabel: "CRM Backfill", detail: message,
  });

  return NextResponse.json({ message, invoices, receipts, expenses, failed });
}
