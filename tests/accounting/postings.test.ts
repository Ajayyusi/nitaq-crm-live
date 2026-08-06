/**
 * Tests for the CRM → Accounting auto-posting rules.
 *
 * Each rule is checked against the double-entry spec in postings.ts:
 * invoices, receipts (linked / advance / per-student A/R), expenses,
 * supplier bills & payments, source reversal, and the postSafely guard.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  resolvePaymentAccount,
  resolveRevenueAccount,
  ensureStudentArAccount,
  postStudentInvoice,
  postCustomerReceipt,
  postExpensePaid,
  postSupplierBill,
  postSupplierPayment,
  reverseEntryForSource,
  postSafely,
} from "@/lib/accounting/postings";
import JournalEntry, { type IJournalEntry } from "@/models/accounting/JournalEntry";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import Enrollment from "@/models/Enrollment";
import {
  connectTestDb,
  disconnectTestDb,
  resetDb,
  seedCoa,
  configureSettings,
  ACC,
} from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await resetDb();
  await seedCoa();
});

/** Find a line by account code, asserting it exists. */
function line(entry: IJournalEntry, accountCode: string) {
  const l = entry.lines.find((x) => x.accountCode === accountCode);
  expect(l, `expected a line for account ${accountCode}`).toBeDefined();
  return l!;
}

async function makeEnrollment(over: Record<string, unknown> = {}) {
  return Enrollment.create({
    enrollmentId: `E-${Math.floor(Math.random() * 1_000_000)}`,
    fullName: "Aisha Rahman",
    phone: "+971500000000",
    course: "IELTS",
    totalFee: 1050,
    amountPaid: 0,
    ...over,
  });
}

describe("resolvePaymentAccount", () => {
  it("maps every CRM payment method to its configured money account", async () => {
    await configureSettings();
    expect(await resolvePaymentAccount("Cash")).toBe(ACC.cash);
    expect(await resolvePaymentAccount("Card")).toBe(ACC.pos);
    expect(await resolvePaymentAccount("POS")).toBe(ACC.pos);
    expect(await resolvePaymentAccount("Tabby")).toBe(ACC.tabby);
    expect(await resolvePaymentAccount("Tamara")).toBe(ACC.tamara);
    expect(await resolvePaymentAccount("Bank Transfer")).toBe(ACC.bank);
    expect(await resolvePaymentAccount("Cheque")).toBe(ACC.bank);
    // Unknown methods fall back to cash ("Online" is not mapped explicitly)
    expect(await resolvePaymentAccount("Online")).toBe(ACC.cash);
    expect(await resolvePaymentAccount("")).toBe(ACC.cash);
    // NOTE: current behaviour — "Petty Cash" matches the "cash" branch first,
    // so it resolves to the cash account, not pettyCashAccount. No CRM enum
    // sends "Petty Cash" today; only a bare "petty" reaches the petty branch.
    expect(await resolvePaymentAccount("Petty Cash")).toBe(ACC.cash);
    expect(await resolvePaymentAccount("petty")).toBe(ACC.pettyCash);
  });
});

describe("resolveRevenueAccount", () => {
  it("uses the per-category map and falls back to the default", async () => {
    await configureSettings({ courseRevenueMap: { IELTS: ACC.revenueAlt } } as never);
    expect(await resolveRevenueAccount("IELTS")).toBe(ACC.revenueAlt);
    expect(await resolveRevenueAccount("Unmapped course")).toBe(ACC.revenue);
  });
});

describe("ensureStudentArAccount", () => {
  it("creates a per-student posting account under Accounts Receivables and links it", async () => {
    const enrollment = await makeEnrollment();
    const code = await ensureStudentArAccount(String(enrollment._id));

    expect(code).toMatch(/^10103\d{5}$/);
    const account = await ChartOfAccount.findOne({ code }).lean();
    expect(account).toMatchObject({
      name: `Aisha Rahman (${enrollment.enrollmentId})`,
      type: "Asset",
      parentCode: ACC.arParent,
      isPosting: true,
    });
    const reloaded = await Enrollment.findById(enrollment._id);
    expect(reloaded!.arAccountCode).toBe(code);
  });

  it("is idempotent — returns the existing account on later calls", async () => {
    const enrollment = await makeEnrollment();
    const first = await ensureStudentArAccount(String(enrollment._id));
    const second = await ensureStudentArAccount(String(enrollment._id));
    expect(second).toBe(first);
    expect(await ChartOfAccount.countDocuments({ code: first! })).toBe(1);
  });

  it("returns null for an unknown enrollment", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    expect(await ensureStudentArAccount(missingId)).toBeNull();
  });
});

describe("postStudentInvoice", () => {
  it("posts Dr student A/R / Cr revenue with VAT disabled", async () => {
    await configureSettings();
    const enrollment = await makeEnrollment();
    const entry = (await postStudentInvoice({
      sourceId: String(enrollment._id),
      sourceNumber: "E-001",
      date: new Date("2026-08-01"),
      studentName: "Aisha Rahman",
      course: "IELTS",
      totalFee: 1050,
      createdBy: "tester",
    }))!;

    expect(entry.sourceType).toBe("Invoice");
    expect(entry.status).toBe("Posted");
    expect(entry.lines).toHaveLength(2);
    const ar = line(entry, (await Enrollment.findById(enrollment._id))!.arAccountCode!);
    expect(ar.debit).toBe(1050);
    expect(line(entry, ACC.revenue).credit).toBe(1050);
  });

  it("splits VAT out of the gross fee when VAT is enabled", async () => {
    await configureSettings({ vatEnabled: true, vatRate: 5 } as never);
    const enrollment = await makeEnrollment();
    const entry = (await postStudentInvoice({
      sourceId: String(enrollment._id),
      sourceNumber: "E-001",
      date: new Date("2026-08-01"),
      studentName: "Aisha Rahman",
      course: "IELTS",
      totalFee: 1050, // gross: 1000 net + 50 VAT at 5%
      createdBy: "tester",
    }))!;

    expect(line(entry, ACC.revenue).credit).toBe(1000);
    expect(line(entry, ACC.outputVat).credit).toBe(50);
    expect(entry.totalDebit).toBe(1050);
    expect(entry.totalCredit).toBe(1050);
  });

  it("falls back to the A/R control account when the enrollment is unknown", async () => {
    await configureSettings();
    const entry = (await postStudentInvoice({
      sourceId: new mongoose.Types.ObjectId().toString(),
      sourceNumber: "E-999",
      date: new Date("2026-08-01"),
      studentName: "Ghost Student",
      course: "IELTS",
      totalFee: 500,
      createdBy: "tester",
    }))!;
    expect(line(entry, ACC.arControl).debit).toBe(500);
  });

  it("does nothing when auto-posting is off or the fee is zero", async () => {
    await configureSettings({ autoPostInvoices: false } as never);
    const enrollment = await makeEnrollment();
    expect(
      await postStudentInvoice({
        sourceId: String(enrollment._id),
        sourceNumber: "E-001",
        date: new Date(),
        studentName: "Aisha Rahman",
        course: "IELTS",
        totalFee: 1050,
        createdBy: "tester",
      })
    ).toBeNull();

    await configureSettings();
    expect(
      await postStudentInvoice({
        sourceId: String(enrollment._id),
        sourceNumber: "E-001",
        date: new Date(),
        studentName: "Aisha Rahman",
        course: "IELTS",
        totalFee: 0,
        createdBy: "tester",
      })
    ).toBeNull();
    expect(await JournalEntry.countDocuments()).toBe(0);
  });
});

describe("postCustomerReceipt", () => {
  const baseReceipt = {
    sourceId: "pay-1",
    sourceNumber: "P-001",
    date: new Date("2026-08-01"),
    studentName: "Aisha Rahman",
    course: "IELTS",
    amount: 500,
    createdBy: "tester",
  };

  it("posts Dr money account / Cr A/R control for a linked payment", async () => {
    await configureSettings();
    const entry = (await postCustomerReceipt({ ...baseReceipt, paymentMethod: "Cash" }))!;
    expect(entry.sourceType).toBe("Receipt");
    expect(line(entry, ACC.cash).debit).toBe(500);
    expect(line(entry, ACC.arControl).credit).toBe(500);
  });

  it("credits the student's own A/R account when an enrollment is linked", async () => {
    await configureSettings();
    const enrollment = await makeEnrollment();
    const entry = (await postCustomerReceipt({
      ...baseReceipt,
      paymentMethod: "Bank Transfer",
      enrollmentId: String(enrollment._id),
    }))!;
    expect(line(entry, ACC.bank).debit).toBe(500);
    const arCode = (await Enrollment.findById(enrollment._id))!.arAccountCode!;
    expect(line(entry, arCode).credit).toBe(500);
  });

  it("credits Fees Advance for an unmatched (advance) payment", async () => {
    await configureSettings();
    const entry = (await postCustomerReceipt({
      ...baseReceipt,
      paymentMethod: "Card",
      asAdvance: true,
    }))!;
    expect(line(entry, ACC.pos).debit).toBe(500);
    expect(line(entry, ACC.feesAdvance).credit).toBe(500);
    expect(entry.description).toContain("[advance]");
  });

  it("does nothing when auto-posting is off or the amount is zero", async () => {
    await configureSettings({ autoPostPayments: false } as never);
    expect(await postCustomerReceipt({ ...baseReceipt, paymentMethod: "Cash" })).toBeNull();

    await configureSettings();
    expect(
      await postCustomerReceipt({ ...baseReceipt, amount: 0, paymentMethod: "Cash" })
    ).toBeNull();
    expect(await JournalEntry.countDocuments()).toBe(0);
  });
});

describe("postExpensePaid", () => {
  it("posts Dr expense + Dr input VAT / Cr money account", async () => {
    await configureSettings();
    const entry = (await postExpensePaid({
      sourceId: "exp-1",
      sourceNumber: "E-004",
      date: new Date("2026-08-01"),
      category: "Supplies",
      description: "Whiteboard markers",
      amountBeforeVAT: 200,
      vatAmount: 10,
      paymentMethod: "Cash",
      createdBy: "tester",
    }))!;

    expect(entry.sourceType).toBe("Expense");
    expect(line(entry, ACC.expenseMisc).debit).toBe(200); // default expense account
    expect(line(entry, ACC.inputVat).debit).toBe(10);
    expect(line(entry, ACC.cash).credit).toBe(210);
  });

  it("uses the explicit expense account when one is given", async () => {
    await configureSettings();
    const entry = (await postExpensePaid({
      sourceId: "exp-2",
      sourceNumber: "E-005",
      date: new Date("2026-08-01"),
      expenseAccountCode: ACC.teacherSalary,
      category: "Salaries",
      description: "August part-time hours",
      amountBeforeVAT: 3000,
      vatAmount: 0,
      paymentMethod: "Bank Transfer",
      createdBy: "tester",
    }))!;
    expect(line(entry, ACC.teacherSalary).debit).toBe(3000);
    expect(line(entry, ACC.bank).credit).toBe(3000);
    expect(entry.lines).toHaveLength(2); // no VAT line
  });

  it("does nothing when auto-posting is off or the total is zero", async () => {
    await configureSettings({ autoPostExpenses: false } as never);
    expect(
      await postExpensePaid({
        sourceId: "exp-3",
        sourceNumber: "E-006",
        date: new Date(),
        category: "Supplies",
        description: "x",
        amountBeforeVAT: 100,
        vatAmount: 0,
        paymentMethod: "Cash",
        createdBy: "tester",
      })
    ).toBeNull();
    expect(await JournalEntry.countDocuments()).toBe(0);
  });
});

describe("supplier postings", () => {
  const SUPPLIER = "2010200001";

  beforeEach(async () => {
    await configureSettings();
    await ChartOfAccount.create({
      code: SUPPLIER,
      name: "Test Supplier LLC",
      type: "Liability",
      category: "LIABILITIES",
      parentCode: ACC.apParent,
      isPosting: true,
    });
  });

  it("postSupplierBill: Dr expense + Dr input VAT / Cr supplier A/P", async () => {
    const entry = (await postSupplierBill({
      sourceId: "bill-1",
      sourceNumber: "SB-0001",
      date: new Date("2026-08-01"),
      supplierAccountCode: SUPPLIER,
      supplierName: "Test Supplier LLC",
      expenseAccountCode: ACC.expenseMisc,
      amountBeforeVAT: 1000,
      vatAmount: 50,
      description: "Printing services",
      createdBy: "tester",
    }))!;

    expect(entry.sourceType).toBe("SupplierBill");
    expect(line(entry, ACC.expenseMisc).debit).toBe(1000);
    expect(line(entry, ACC.inputVat).debit).toBe(50);
    expect(line(entry, SUPPLIER).credit).toBe(1050);
  });

  it("postSupplierPayment: Dr supplier A/P / Cr money account", async () => {
    const entry = (await postSupplierPayment({
      sourceId: "sp-1",
      sourceNumber: "SP-0001",
      date: new Date("2026-08-01"),
      supplierAccountCode: SUPPLIER,
      supplierName: "Test Supplier LLC",
      amount: 1050,
      paymentAccountCode: ACC.bank,
      createdBy: "tester",
    }))!;

    expect(entry.sourceType).toBe("SupplierPayment");
    expect(line(entry, SUPPLIER).debit).toBe(1050);
    expect(line(entry, ACC.bank).credit).toBe(1050);
  });
});

describe("reverseEntryForSource", () => {
  it("reverses the active entry for a source document", async () => {
    await configureSettings();
    const original = (await postCustomerReceipt({
      sourceId: "pay-9",
      sourceNumber: "P-009",
      date: new Date("2026-08-01"),
      studentName: "Aisha Rahman",
      amount: 250,
      paymentMethod: "Cash",
      createdBy: "tester",
    }))!;

    const reversal = await reverseEntryForSource("Receipt", "pay-9", "tester", "payment deleted");
    expect(reversal).not.toBeNull();
    expect(reversal!.sourceType).toBe("Reversal");

    const reloaded = await JournalEntry.findById(original._id);
    expect(reloaded!.status).toBe("Reversed");
  });

  it("returns null when no active entry exists for the source", async () => {
    expect(await reverseEntryForSource("Receipt", "nope", "tester", "n/a")).toBeNull();
  });
});

describe("postSafely", () => {
  it("returns the result on success and null on failure — never throws", async () => {
    expect(await postSafely(async () => 42)).toBe(42);
    expect(
      await postSafely(async () => {
        throw new Error("posting exploded");
      })
    ).toBeNull();
  });
});
