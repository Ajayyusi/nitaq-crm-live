/**
 * CRM → Accounting auto-posting rules.
 *
 * Each helper implements one double-entry rule from the accounting spec and
 * resolves ALL account codes through AccountingSettings (never hardcoded).
 * Helpers are fire-safe: a posting failure must never break the CRM action,
 * so callers wrap them with postSafely() which logs and continues.
 */

import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { createJournalEntry } from "./engine";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Map a CRM payment method to the configured money account. */
export async function resolvePaymentAccount(method: string): Promise<string> {
  const s = await getAccountingSettings();
  const m = (method || "").toLowerCase();
  if (m.includes("cash")) return s.defaultCashAccount;
  if (m.includes("card") || m.includes("pos")) return s.defaultPosAccount;
  if (m.includes("tabby")) return s.tabbyAccount;
  if (m.includes("tamara")) return s.tamaraAccount;
  if (m.includes("bank") || m.includes("transfer") || m.includes("cheque")) return s.defaultBankAccount;
  if (m.includes("petty")) return s.pettyCashAccount;
  return s.defaultCashAccount;
}

/** Resolve the revenue account for a course via the per-category map. */
export async function resolveRevenueAccount(course: string): Promise<string> {
  const s = await getAccountingSettings();
  const map = s.courseRevenueMap instanceof Map
    ? Object.fromEntries(s.courseRevenueMap)
    : (s.courseRevenueMap ?? {});
  return map[course] || s.defaultRevenueAccount;
}

/**
 * Student invoice (enrollment fee):
 *   Dr Accounts Receivable        total
 *     Cr Course Revenue             net
 *     Cr Output VAT                 vat (if enabled)
 */
export async function postStudentInvoice(params: {
  sourceId: string; sourceNumber: string; date: Date | string;
  studentName: string; course: string; totalFee: number; createdBy: string;
}) {
  if (params.totalFee <= 0) return null;
  const s = await getAccountingSettings();
  if (!s.autoPostInvoices) return null;
  const revenueAccount = await resolveRevenueAccount(params.course);

  const vat = s.vatEnabled ? round2(params.totalFee * s.vatRate / (100 + s.vatRate)) : 0;
  const net = round2(params.totalFee - vat);

  const lines = [
    { accountCode: s.accountsReceivable, debit: params.totalFee, studentRef: params.studentName, courseRef: params.course },
    { accountCode: revenueAccount, credit: net, studentRef: params.studentName, courseRef: params.course },
  ];
  if (vat > 0) lines.push({ accountCode: s.outputVatAccount, credit: vat, studentRef: params.studentName, courseRef: params.course });

  return createJournalEntry({
    date: params.date,
    sourceType: "Invoice",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Invoice — ${params.studentName} · ${params.course}`,
    lines,
    createdBy: params.createdBy,
  });
}

/**
 * Customer receipt:
 *   Dr Cash/Bank/POS/Tabby/Tamara   amount
 *     Cr Accounts Receivable          amount
 */
export async function postCustomerReceipt(params: {
  sourceId: string; sourceNumber: string; date: Date | string;
  studentName: string; course?: string; amount: number; paymentMethod: string; createdBy: string;
}) {
  if (params.amount <= 0) return null;
  const s = await getAccountingSettings();
  if (!s.autoPostPayments) return null;
  const moneyAccount = await resolvePaymentAccount(params.paymentMethod);

  return createJournalEntry({
    date: params.date,
    sourceType: "Receipt",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Receipt — ${params.studentName}${params.course ? ` · ${params.course}` : ""} (${params.paymentMethod})`,
    lines: [
      { accountCode: moneyAccount, debit: params.amount, studentRef: params.studentName, courseRef: params.course },
      { accountCode: s.accountsReceivable, credit: params.amount, studentRef: params.studentName, courseRef: params.course },
    ],
    createdBy: params.createdBy,
  });
}

/**
 * Expense paid immediately:
 *   Dr Expense account              net
 *   Dr Input VAT                    vat (if any)
 *     Cr Cash/Bank/Petty Cash         total
 */
export async function postExpensePaid(params: {
  sourceId: string; sourceNumber: string; date: Date | string;
  expenseAccountCode?: string; category: string; description: string;
  amountBeforeVAT: number; vatAmount: number; paymentMethod: string; createdBy: string;
}) {
  const s = await getAccountingSettings();
  if (!s.autoPostExpenses) return null;
  const total = round2(params.amountBeforeVAT + params.vatAmount);
  if (total <= 0) return null;
  const expenseAccount = params.expenseAccountCode || s.defaultExpenseAccount;
  const moneyAccount = await resolvePaymentAccount(params.paymentMethod);

  const lines = [
    { accountCode: expenseAccount, debit: params.amountBeforeVAT, description: params.description },
  ];
  if (params.vatAmount > 0) lines.push({ accountCode: s.inputVatAccount, debit: params.vatAmount, description: "Input VAT" });
  lines.push({ accountCode: moneyAccount, credit: total } as never);

  return createJournalEntry({
    date: params.date,
    sourceType: "Expense",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Expense — ${params.category}: ${params.description || "-"}`,
    lines,
    createdBy: params.createdBy,
  });
}

/**
 * Supplier bill:
 *   Dr Expense/Asset account        net
 *   Dr Input VAT                    vat (if any)
 *     Cr Supplier account (A/P)       total
 */
export async function postSupplierBill(params: {
  sourceId: string; sourceNumber: string; date: Date | string;
  supplierAccountCode: string; supplierName: string; expenseAccountCode: string;
  amountBeforeVAT: number; vatAmount: number; description?: string; createdBy: string;
}) {
  const s = await getAccountingSettings();
  const total = round2(params.amountBeforeVAT + params.vatAmount);
  const lines = [
    { accountCode: params.expenseAccountCode, debit: params.amountBeforeVAT, supplierRef: params.supplierName, description: params.description },
  ];
  if (params.vatAmount > 0) lines.push({ accountCode: s.inputVatAccount, debit: params.vatAmount, supplierRef: params.supplierName, description: "Input VAT" });
  lines.push({ accountCode: params.supplierAccountCode, credit: total, supplierRef: params.supplierName } as never);

  return createJournalEntry({
    date: params.date,
    sourceType: "SupplierBill",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Supplier bill — ${params.supplierName}${params.description ? `: ${params.description}` : ""}`,
    lines,
    createdBy: params.createdBy,
  });
}

/**
 * Supplier payment:
 *   Dr Supplier account (A/P)       amount
 *     Cr Cash/Bank/Petty Cash         amount
 */
export async function postSupplierPayment(params: {
  sourceId: string; sourceNumber: string; date: Date | string;
  supplierAccountCode: string; supplierName: string; amount: number;
  paymentAccountCode: string; createdBy: string;
}) {
  return createJournalEntry({
    date: params.date,
    sourceType: "SupplierPayment",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Supplier payment — ${params.supplierName}`,
    lines: [
      { accountCode: params.supplierAccountCode, debit: params.amount, supplierRef: params.supplierName },
      { accountCode: params.paymentAccountCode, credit: params.amount, supplierRef: params.supplierName },
    ],
    createdBy: params.createdBy,
  });
}

/**
 * Wrapper: never let an accounting failure break the CRM operation.
 * Duplicate-source errors are silently ignored (entry already exists).
 */
export async function postSafely<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[accounting] auto-post failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
