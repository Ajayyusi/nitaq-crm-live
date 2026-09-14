/**
 * Measure — and optionally repair — the damage from the pre-audit bugs that
 * let CRM documents and the ledger drift apart.
 *
 * DRY RUN BY DEFAULT: nothing is written unless --apply is passed.
 *
 *   npx tsx --env-file=.env.local scripts/migrations/ledger-sync-report.ts           # report
 *   npx tsx --env-file=.env.local scripts/migrations/ledger-sync-report.ts --apply   # repost missing entries
 *
 * Sections
 *  1. Received payments with NO live receipt/refund entry   (payment-edit bug)   → --apply re-posts
 *  2. Expenses with NO live expense entry                   (expense-edit bug)   → --apply re-posts
 *  3. Enrollments with a fee but NO live invoice entry                           → --apply re-posts
 *  4. Refund-type payments that were posted as a RECEIPT (cash overstated ×2)   → REPORT ONLY
 *  5. Enrollment.amountPaid ≠ Σ linked Received payments                        → REPORT ONLY
 *
 * Sections 4 and 5 change posted history or a student's balance and need an
 * accountant's decision, so they are never applied automatically. --apply
 * posts each missing entry through the same posting rules the app uses; an
 * entry that can't be posted (e.g. dated in a locked period) is reported and
 * skipped, never forced.
 */
import mongoose from "mongoose";
import { Payment, Expense } from "../../models/Financial";
import Enrollment from "../../models/Enrollment";
import JournalEntry from "../../models/accounting/JournalEntry";
import { planForPayment, planExpensePaid, planStudentInvoice, postForNewDocument } from "../../lib/accounting/postings";

const APPLY = process.argv.includes("--apply");
const ACTOR = "ledger-sync-report (migration)";
const round2 = (n: number) => Math.round(n * 100) / 100;

type Tally = { scanned: number; needing: number; changed: number; skipped: number; errors: string[] };
const tally = (): Tally => ({ scanned: 0, needing: 0, changed: 0, skipped: 0, errors: [] });

function print(title: string, t: Tally, applies: boolean) {
  console.log(`\n${title}`);
  console.log(`  records scanned:        ${t.scanned}`);
  console.log(`  records needing change: ${t.needing}`);
  if (applies) {
    console.log(`  records changed:        ${t.changed}${APPLY ? "" : " (dry run)"}`);
    console.log(`  records skipped:        ${t.skipped}`);
  }
  console.log(`  errors:                 ${t.errors.length}`);
  for (const e of t.errors.slice(0, 50)) console.log(`    - ${e}`);
}

async function activeSourceIds(sourceTypes: string[]): Promise<Set<string>> {
  const rows = await JournalEntry.find({ sourceType: { $in: sourceTypes }, status: "Posted", sourceId: { $type: "string" } })
    .select("sourceId").lean();
  return new Set(rows.map((r) => r.sourceId!));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (pass --env-file=.env.local).");
  // autoIndex off: importing the models must not build indexes on the target database.
  await mongoose.connect(uri, { autoIndex: false });
  console.log(APPLY ? "MODE: APPLY — missing entries will be posted." : "MODE: DRY RUN — nothing will be written.");

  // 1. Payments
  const payments = tally();
  const livePayment = await activeSourceIds(["Receipt", "Refund"]);
  for (const p of await Payment.find({ status: "Received", amount: { $gt: 0 } }).lean()) {
    payments.scanned++;
    if (livePayment.has(String(p._id))) continue;
    payments.needing++;
    console.log(`  payment ${p.paymentId} · ${p.studentName} · AED ${p.amount} · ${p.datePaid?.toISOString().slice(0, 10) ?? "no date"}`);
    if (!APPLY) continue;
    const { entry, postingError } = await postForNewDocument(
      await planForPayment({ ...p, datePaid: p.datePaid ?? p.createdAt }, ACTOR)
    );
    if (entry) {
      await Payment.updateOne({ _id: p._id }, { $set: { journalEntryId: entry._id }, $unset: { postingError: 1 } });
      payments.changed++;
    } else {
      payments.skipped++;
      if (postingError) payments.errors.push(`${p.paymentId}: ${postingError}`);
    }
  }
  print("1. Received payments with no live ledger entry", payments, true);

  // 2. Expenses
  const expenses = tally();
  const liveExpense = await activeSourceIds(["Expense"]);
  for (const x of await Expense.find({ amount: { $gt: 0 } }).lean()) {
    expenses.scanned++;
    if (liveExpense.has(String(x._id))) continue;
    expenses.needing++;
    console.log(`  expense ${x.expenseId} · ${x.category} · AED ${x.amount}`);
    if (!APPLY) continue;
    const vatAmount = x.vatAmount ?? 0;
    const { entry, postingError } = await postForNewDocument(await planExpensePaid({
      sourceId: String(x._id), sourceNumber: x.expenseId, date: x.expenseDate ?? x.createdAt,
      expenseAccountCode: x.expenseAccountCode, category: x.category, description: x.description ?? "",
      amountBeforeVAT: x.amountBeforeVAT ?? round2(x.amount - vatAmount), vatAmount,
      paymentMethod: x.paymentMethod ?? "Cash", createdBy: ACTOR,
    }).catch((e: Error) => { expenses.errors.push(`${x.expenseId}: ${e.message}`); return null; }));
    if (entry) {
      await Expense.updateOne({ _id: x._id }, { $set: { journalEntryId: entry._id }, $unset: { postingError: 1 } });
      expenses.changed++;
    } else {
      expenses.skipped++;
      if (postingError) expenses.errors.push(`${x.expenseId}: ${postingError}`);
    }
  }
  print("2. Expenses with no live ledger entry", expenses, true);

  // 3. Enrollment invoices
  const invoices = tally();
  const liveInvoice = await activeSourceIds(["Invoice"]);
  for (const e of await Enrollment.find({ totalFee: { $gt: 0 } }).lean()) {
    invoices.scanned++;
    if (liveInvoice.has(String(e._id))) continue;
    invoices.needing++;
    console.log(`  enrollment ${e.enrollmentId} · ${e.fullName} · fee AED ${e.totalFee}`);
    if (!APPLY) continue;
    const { entry, postingError } = await postForNewDocument(await planStudentInvoice({
      sourceId: String(e._id), sourceNumber: e.enrollmentId ?? String(e._id),
      date: e.registrationDate ?? e.createdAt, studentName: e.fullName, course: e.course ?? "",
      totalFee: e.totalFee ?? 0, createdBy: ACTOR,
    }));
    if (entry) {
      await Enrollment.updateOne({ _id: e._id }, { $unset: { postingError: 1 } });
      invoices.changed++;
    } else {
      invoices.skipped++;
      if (postingError) invoices.errors.push(`${e.enrollmentId}: ${postingError}`);
    }
  }
  print("3. Enrollments with a fee but no live invoice entry", invoices, true);

  // 4. Refunds posted as receipts (report only)
  const refunds = tally();
  const refundPayments = await Payment.find({ paymentType: "Refund", status: "Received" }).select("paymentId amount").lean();
  const asReceipt = await JournalEntry.find({
    sourceType: "Receipt", status: "Posted", sourceId: { $in: refundPayments.map((p) => String(p._id)) },
  }).select("sourceId jvNumber").lean();
  refunds.scanned = refundPayments.length;
  refunds.needing = asReceipt.length;
  for (const j of asReceipt) {
    const p = refundPayments.find((x) => String(x._id) === j.sourceId);
    console.log(`  refund ${p?.paymentId} · AED ${p?.amount} posted as receipt ${j.jvNumber} — reverse it and record the refund`);
  }
  print("4. Refunds posted as receipts (cash overstated by twice the refund) — REPORT ONLY", refunds, false);

  // 5. amountPaid vs payments (report only)
  const balances = tally();
  const sums = await Payment.aggregate<{ _id: unknown; received: number }>([
    { $match: { enrollmentId: { $type: "objectId" }, status: "Received" } },
    { $group: {
      _id: "$enrollmentId",
      received: { $sum: { $cond: [{ $eq: ["$paymentType", "Refund"] }, { $multiply: ["$amount", -1] }, "$amount"] } },
    } },
  ]);
  const byEnrollment = new Map(sums.map((s) => [String(s._id), round2(s.received)]));
  for (const e of await Enrollment.find({}).select("enrollmentId fullName amountPaid").lean()) {
    balances.scanned++;
    const received = byEnrollment.get(String(e._id)) ?? 0;
    const onFile = round2(e.amountPaid ?? 0);
    if (received === onFile) continue;
    balances.needing++;
    console.log(`  ${e.enrollmentId} · ${e.fullName}: amountPaid AED ${onFile} vs payments AED ${received}`);
  }
  print("5. Enrollment.amountPaid different from linked payments — REPORT ONLY", balances, false);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(2);
});
