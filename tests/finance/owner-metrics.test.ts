/**
 * Owner finance cards — golden postings.
 *
 * One realistic month of postings with a hand-computed answer for every card.
 * If a classification or definition drifts (a transfer counted as money out,
 * teacher pay left out of profit, a UAE-midnight receipt put in the wrong
 * month, a reversed entry still counted) one of these fails.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getOwnerFinanceSummary, uaeDate, uaeThisMonth } from "@/lib/finance/owner-metrics";
import {
  postStudentInvoice, postCustomerReceipt, postCustomerRefund, postExpensePaid,
  postSupplierBill, postSupplierPayment,
} from "@/lib/accounting/postings";
import { aggregateBalances, createJournalEntry, reverseJournalEntry } from "@/lib/accounting/engine";
import Enrollment from "@/models/Enrollment";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import { connectTestDb, disconnectTestDb, resetDb, seedCoa, configureSettings, ACC } from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
  await JournalEntry.init();
});
afterAll(async () => {
  await disconnectTestDb();
});

const by = "tester";

/** August 2026, in UAE dates. */
async function postAugust() {
  await configureSettings({ vatEnabled: true, vatRate: 5 });
  await ChartOfAccount.updateOne({ code: ACC.bank }, { $set: { openingDebit: 1000 } });

  const enrollment = await Enrollment.create({
    enrollmentId: "E-1", fullName: "Aisha Rahman", phone: "+971500000001", course: "IELTS",
    totalFee: 1050, amountPaid: 0,
  });
  const eid = String(enrollment._id);

  // Invoice AED 1,050 incl. 5% VAT → revenue 1,000, output VAT 50
  await postStudentInvoice({ sourceId: eid, sourceNumber: "E-1", date: "2026-08-05", studentName: "Aisha Rahman", course: "IELTS", totalFee: 1050, createdBy: by });
  // Receipt against the invoice, cash 600
  await postCustomerReceipt({ sourceId: "p1", sourceNumber: "P-1", date: "2026-08-06", studentName: "Aisha Rahman", course: "IELTS", amount: 600, paymentMethod: "Cash", enrollmentId: eid, createdBy: by });
  // Advance from another student, bank 200
  await postCustomerReceipt({ sourceId: "p2", sourceNumber: "P-2", date: "2026-08-07", studentName: "Omar Saleh", amount: 200, paymentMethod: "Bank Transfer", asAdvance: true, createdBy: by });
  // Part of that advance refunded in cash, 100
  await postCustomerRefund({ sourceId: "p3", sourceNumber: "P-3", date: "2026-08-08", studentName: "Omar Saleh", amount: 100, paymentMethod: "Cash", createdBy: by });
  // Expense 210 incl. VAT → expense 200, input VAT 10, paid cash
  await postExpensePaid({ sourceId: "x1", sourceNumber: "EXP-1", date: "2026-08-09", category: "Supplies", description: "Stationery", amountBeforeVAT: 200, vatAmount: 10, paymentMethod: "Cash", createdBy: by });
  // Supplier bill 300 on account, 100 paid from bank
  await postSupplierBill({ sourceId: "b1", sourceNumber: "SB-1", date: "2026-08-10", supplierAccountCode: "SP001", supplierName: "Etisalat", expenseAccountCode: ACC.expenseMisc, amountBeforeVAT: 300, vatAmount: 0, createdBy: by });
  await postSupplierPayment({ sourceId: "sp1", sourceNumber: "SPY-1", date: "2026-08-11", supplierAccountCode: "SP001", supplierName: "Etisalat", amount: 100, paymentAccountCode: ACC.bank, createdBy: by });
  // Teacher payout 400 cash (posted like the payroll module does)
  await createJournalEntry({ date: "2026-08-12", sourceType: "Expense", sourceId: "tp1", sourceNumber: "TP-1", description: "Teacher payment", createdBy: by,
    lines: [{ accountCode: ACC.teacherSalary, debit: 400 }, { accountCode: ACC.cash, credit: 400 }] });
  // Cash deposited to the bank: a transfer, not money in or out
  await createJournalEntry({ date: "2026-08-13", sourceType: "JV", description: "Cash deposit", createdBy: by,
    lines: [{ accountCode: ACC.bank, debit: 500 }, { accountCode: ACC.cash, credit: 500 }] });
  // A mistaken expense, reversed — must not count anywhere
  const wrong = await createJournalEntry({ date: "2026-08-14", sourceType: "Expense", sourceId: "x-wrong", sourceNumber: "EXP-9", description: "Entered twice", createdBy: by,
    lines: [{ accountCode: ACC.expenseMisc, debit: 999 }, { accountCode: ACC.cash, credit: 999 }] });
  await reverseJournalEntry(String(wrong._id), by, "duplicate");
  // 00:30 UAE on 1 September (= 20:30 UTC on 31 August) — September money
  await postCustomerReceipt({ sourceId: "p4", sourceNumber: "P-4", date: "2026-08-31T20:30:00Z", studentName: "Late Payer", amount: 70, paymentMethod: "Cash", asAdvance: true, createdBy: by });
}

describe("owner finance summary — August golden month", () => {
  beforeEach(async () => {
    await resetDb();
    await seedCoa();
    await postAugust();
  });

  it("computes every card from the ledger", async () => {
    const s = await getOwnerFinanceSummary({ from: "2026-08-01", to: "2026-08-31" });
    expect(s.metrics).toEqual({
      earnedRevenue: 1000,
      cashCollected: 800,       // 600 + 200 advance; the 1 Sep receipt is excluded
      netProfit: 100,           // 1000 − (200 expense + 300 supplier bill + 400 teacher pay)
      availableCash: 990,       // bank opening 1000; cash −610; bank +600
      customersOweUs: 450,      // 1050 invoiced − 600 received
      weOwe: 200,               // 300 bill − 100 paid
      moneyOut: 810,            // refund 100 + expense 210 + supplier 100 + teacher 400; deposit excluded
      vatEstimate: 40,          // output 50 − input 10
    });
    expect(s.detail).toMatchObject({ recognisedExpenses: 900, customerAdvances: 100, outputVat: 50, inputVat: 10, clearingCash: 0 });
  });

  it("puts a receipt taken just after UAE midnight in the new month", async () => {
    const sept = await getOwnerFinanceSummary({ from: "2026-09-01", to: "2026-09-30" });
    expect(sept.metrics.cashCollected).toBe(70);
    expect(sept.metrics.earnedRevenue).toBe(0);
  });

  it("net profit agrees with the trial balance for the same period", async () => {
    const s = await getOwnerFinanceSummary({ from: "2026-08-01", to: "2026-08-31" });
    const [coa, tb] = await Promise.all([
      ChartOfAccount.find({ isPosting: true }).select("code type").lean(),
      aggregateBalances(new Date("2026-08-01T00:00:00+04:00"), new Date("2026-08-31T23:59:59.999+04:00")),
    ]);
    const typeOf = new Map(coa.map((a) => [a.code, a.type]));
    const tbProfit = tb.reduce((sum, b) => {
      const t = typeOf.get(b.accountCode);
      if (t === "Revenue") return sum + b.periodCredit - b.periodDebit;
      if (t === "Expense") return sum - (b.periodDebit - b.periodCredit);
      return sum;
    }, 0);
    expect(s.metrics.netProfit).toBe(Math.round(tbProfit * 100) / 100);
  });

  it("the monthly chart uses the same definitions as the cards", async () => {
    const s = await getOwnerFinanceSummary({ from: "2026-08-01", to: "2026-08-31" });
    const aug = s.monthly.find((m) => m.month === "Aug");
    expect(aug).toEqual({ month: "Aug", revenue: 1000, expenses: 900, net: 100 });
    expect(s.monthly).toHaveLength(6);
  });

  it("breaks revenue down by course and lists who owes money", async () => {
    const s = await getOwnerFinanceSummary({ from: "2026-08-01", to: "2026-08-31" });
    expect(s.revenueByCourse).toEqual([{ name: "IELTS", value: 1000 }]);
    expect(s.topReceivables).toHaveLength(1);
    expect(s.topReceivables[0].balance).toBe(450);
    expect(s.expensesByAccount.reduce((t, e) => t + e.total, 0)).toBe(900);
  });

  it("all time includes everything, with balances as of now", async () => {
    const s = await getOwnerFinanceSummary({ from: "", to: "" });
    expect(s.metrics.cashCollected).toBe(870);
    expect(s.metrics.availableCash).toBe(1060);
  });
});

describe("UAE calendar helpers", () => {
  it("uses the UAE date, not UTC", () => {
    expect(uaeDate(new Date("2026-09-30T21:30:00Z"))).toBe("2026-10-01");
    expect(uaeThisMonth(new Date("2026-09-30T21:30:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-01" });
  });
});
