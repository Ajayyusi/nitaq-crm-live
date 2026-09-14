/**
 * CRM → Accounting auto-posting rules.
 *
 * Each rule is split in two:
 *  - planX(params)  → the journal entry that WOULD be posted (or null when the
 *                     rule doesn't apply, e.g. auto-posting is switched off)
 *  - postX(params)  → plan + createJournalEntry
 *
 * Routes that change a CRM document use syncSourceEntry(), which validates the
 * planned entry (and the lock on any entry it replaces) before changing
 * anything, so the document and the ledger can't silently drift apart.
 * Every account code resolves through AccountingSettings (never hardcoded).
 */

import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry, { type IJournalEntry, type JournalSourceType } from "@/models/accounting/JournalEntry";
import Enrollment from "@/models/Enrollment";
import { getNextSequence } from "@/models/Counter";
import {
  AccountingError,
  assertOpenPeriod,
  createJournalEntry,
  loadPostingAccounts,
  preflightJournalEntry,
  reverseJournalEntry,
  type CreateJournalEntryInput,
} from "./engine";

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
 * Ensure the enrollment's student has their own ledger account under
 * ACCOUNTS RECEIVABLES (10103) — like suppliers under Accounts Payable.
 * Returns the account code, creating account + linking enrollment if needed.
 *
 * Concurrency-safe: the link is claimed with a conditional update, so two
 * postings for the same student at the same moment end up on ONE account
 * (the loser's freshly created account is removed again).
 */
export async function ensureStudentArAccount(enrollmentId: string): Promise<string | null> {
  const enrollment = await Enrollment.findById(enrollmentId).select("fullName enrollmentId arAccountCode").lean();
  if (!enrollment) return null;
  if (enrollment.arAccountCode) {
    const exists = await ChartOfAccount.findOne({ code: enrollment.arAccountCode }).lean();
    if (exists) return enrollment.arAccountCode;
  }
  const seq = await getNextSequence("student-ar-account");
  // Seeded placeholder is 1010300001 ("Student-1"), so student accounts continue from -00002
  const code = `10103${String(seq + 1).padStart(5, "0")}`;
  await ChartOfAccount.create({
    code,
    name: `${enrollment.fullName} (${enrollment.enrollmentId})`,
    type: "Asset",
    category: "ASSETS",
    subCategory: "CURRENT ASSETS",
    mainAccount: "ACCOUNTS RECEIVABLES",
    parentCode: "10103",
    isPosting: true,
    isSystem: false,
  });
  // Claim: only link if nobody else linked a (still-existing) account meanwhile
  const claimed = await Enrollment.findOneAndUpdate(
    { _id: enrollmentId, arAccountCode: enrollment.arAccountCode ?? null },
    { $set: { arAccountCode: code } },
    { new: true }
  ).lean();
  if (claimed) return code;
  await ChartOfAccount.deleteOne({ code, isSystem: false });
  const winner = await Enrollment.findById(enrollmentId).select("arAccountCode").lean();
  return winner?.arAccountCode ?? null;
}

// ── Plans ────────────────────────────────────────────────────────────────────

interface InvoiceParams {
  sourceId: string; sourceNumber: string; date: Date | string;
  studentName: string; course: string; totalFee: number; createdBy: string;
}

/**
 * Student invoice (enrollment fee):
 *   Dr Accounts Receivable        total
 *     Cr Course Revenue             net
 *     Cr Output VAT                 vat (if enabled)
 */
export async function planStudentInvoice(params: InvoiceParams): Promise<CreateJournalEntryInput | null> {
  if (params.totalFee <= 0) return null;
  const s = await getAccountingSettings();
  if (!s.autoPostInvoices) return null;
  const revenueAccount = await resolveRevenueAccount(params.course);
  // Per-student receivable account (sourceId is the enrollment id); falls
  // back to the A/R control account if the enrollment can't be found.
  const arAccount = (await ensureStudentArAccount(params.sourceId)) ?? s.accountsReceivable;

  const vat = s.vatEnabled ? round2(params.totalFee * s.vatRate / (100 + s.vatRate)) : 0;
  const net = round2(params.totalFee - vat);

  const lines = [
    { accountCode: arAccount, debit: params.totalFee, studentRef: params.studentName, courseRef: params.course },
    { accountCode: revenueAccount, credit: net, studentRef: params.studentName, courseRef: params.course },
  ];
  if (vat > 0) lines.push({ accountCode: s.outputVatAccount, credit: vat, studentRef: params.studentName, courseRef: params.course });

  return {
    date: params.date,
    sourceType: "Invoice",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Invoice — ${params.studentName} · ${params.course}`,
    lines,
    createdBy: params.createdBy,
  };
}

interface ReceiptParams {
  sourceId: string; sourceNumber: string; date: Date | string;
  studentName: string; course?: string; amount: number; paymentMethod: string; createdBy: string;
  /** true when the payment is NOT linked to an invoice/enrollment */
  asAdvance?: boolean;
  /** enrollment id — credits that student's own A/R account */
  enrollmentId?: string;
}

/**
 * Customer receipt:
 *   Dr Cash/Bank/POS/Tabby/Tamara   amount
 *     Cr Accounts Receivable          amount   (payment linked to an enrollment/invoice)
 *     Cr Fees Advance                 amount   (unmatched payment — no invoice exists)
 *
 * Crediting A/R for a receipt with no invoice would push receivables
 * negative, so standalone payments credit Fees Received in Advance instead.
 */
export async function planCustomerReceipt(params: ReceiptParams): Promise<CreateJournalEntryInput | null> {
  if (params.amount <= 0) return null;
  const s = await getAccountingSettings();
  if (!s.autoPostPayments) return null;
  const moneyAccount = await resolvePaymentAccount(params.paymentMethod);
  let creditAccount = params.asAdvance ? s.feesAdvanceAccount : s.accountsReceivable;
  if (!params.asAdvance && params.enrollmentId) {
    creditAccount = (await ensureStudentArAccount(params.enrollmentId)) ?? creditAccount;
  }

  return {
    date: params.date,
    sourceType: "Receipt",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Receipt — ${params.studentName}${params.course ? ` · ${params.course}` : ""} (${params.paymentMethod})${params.asAdvance ? " [advance]" : ""}`,
    lines: [
      { accountCode: moneyAccount, debit: params.amount, studentRef: params.studentName, courseRef: params.course },
      { accountCode: creditAccount, credit: params.amount, studentRef: params.studentName, courseRef: params.course },
    ],
    createdBy: params.createdBy,
  };
}

/**
 * Customer refund (money paid back to a student):
 *   Dr Refunds account (if configured in Accounting Settings), otherwise
 *      the student's A/R account (enrollment-linked) or Fees Advance (unlinked)
 *     Cr Cash/Bank/POS                amount
 *
 * Previously a Received "Refund" payment was posted as a RECEIPT — cash went
 * UP by the refunded amount. Debiting A/R reinstates what the student owes;
 * if the fee itself is being waived, the accountant posts the credit note
 * (Dr Revenue / Dr Output VAT / Cr A/R) — that revenue and VAT adjustment is a
 * judgement for the accountant / tax agent and is deliberately not automated.
 */
export async function planCustomerRefund(params: ReceiptParams): Promise<CreateJournalEntryInput | null> {
  if (params.amount <= 0) return null;
  const s = await getAccountingSettings();
  if (!s.autoPostPayments) return null;
  const moneyAccount = await resolvePaymentAccount(params.paymentMethod);
  let debitAccount = s.refundAccount;
  if (!debitAccount) {
    debitAccount = params.enrollmentId
      ? (await ensureStudentArAccount(params.enrollmentId)) ?? s.accountsReceivable
      : s.feesAdvanceAccount;
  }

  return {
    date: params.date,
    sourceType: "Refund",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Refund — ${params.studentName}${params.course ? ` · ${params.course}` : ""} (${params.paymentMethod})`,
    lines: [
      { accountCode: debitAccount, debit: params.amount, studentRef: params.studentName, courseRef: params.course },
      { accountCode: moneyAccount, credit: params.amount, studentRef: params.studentName, courseRef: params.course },
    ],
    createdBy: params.createdBy,
  };
}

interface ExpenseParams {
  sourceId: string; sourceNumber: string; date: Date | string;
  expenseAccountCode?: string; category: string; description: string;
  amountBeforeVAT: number; vatAmount: number; paymentMethod: string; createdBy: string;
}

/**
 * Expense paid immediately:
 *   Dr Expense account              net
 *   Dr Input VAT                    vat (if any)
 *     Cr Cash/Bank/Petty Cash         total
 */
export async function planExpensePaid(params: ExpenseParams): Promise<CreateJournalEntryInput | null> {
  const s = await getAccountingSettings();
  if (!s.autoPostExpenses) return null;
  const total = round2(params.amountBeforeVAT + params.vatAmount);
  if (total <= 0) return null;
  const expenseAccount = params.expenseAccountCode || s.defaultExpenseAccount;
  await assertExpenseAccount(expenseAccount);
  const moneyAccount = await resolvePaymentAccount(params.paymentMethod);

  const lines = [
    { accountCode: expenseAccount, debit: params.amountBeforeVAT, description: params.description },
  ];
  if (params.vatAmount > 0) lines.push({ accountCode: s.inputVatAccount, debit: params.vatAmount, description: "Input VAT" });
  lines.push({ accountCode: moneyAccount, credit: total } as never);

  return {
    date: params.date,
    sourceType: "Expense",
    sourceId: params.sourceId,
    sourceNumber: params.sourceNumber,
    description: `Expense — ${params.category}: ${params.description || "-"}`,
    lines,
    createdBy: params.createdBy,
  };
}

/**
 * VAT split of a VAT-inclusive total. The rate must be 0 or the configured
 * VAT rate: any other rate claimed input VAT UAE law doesn't allow (a 50%
 * rate on a 150 receipt claimed 50 of input VAT).
 */
export async function splitInclusiveVat(total: number, rawRate: unknown) {
  const rate = Number(rawRate) || 0;
  const s = await getAccountingSettings();
  if (rate !== 0 && rate !== s.vatRate) {
    throw new AccountingError(`VAT rate must be 0 or ${s.vatRate}%.`);
  }
  const vatAmount = rate > 0 ? round2(total * rate / (100 + rate)) : 0;
  return { vatRate: rate, vatAmount, amountBeforeVAT: round2(total - vatAmount) };
}

/**
 * The account an expense is debited to must be something an expense can be:
 * an Expense account, or an Asset for capitalised purchases — never a cash,
 * bank or receivable account, and never revenue, equity or a liability.
 * Finance staff pick this account on the Expenses page; without the check
 * an "expense" could quietly move money between bank accounts or a student's
 * receivable.
 */
export async function assertExpenseAccount(code: string): Promise<void> {
  const acc = (await loadPostingAccounts([code])).get(code)!;
  const moneyOrReceivable = ["CASH", "BANKS", "ACCOUNTS RECEIVABLES"].includes(acc.mainAccount ?? "");
  if (!(acc.type === "Expense" || (acc.type === "Asset" && !moneyOrReceivable))) {
    throw new AccountingError(`Account ${code} (${acc.name}) can't be used as an expense account.`);
  }
}

// ── Post = plan + create (kept for existing callers and tests) ──────────────

const postPlan = async (plan: CreateJournalEntryInput | null) => (plan ? createJournalEntry(plan) : null);

export async function postStudentInvoice(params: InvoiceParams) {
  return postPlan(await planStudentInvoice(params));
}

export async function postCustomerReceipt(params: ReceiptParams) {
  return postPlan(await planCustomerReceipt(params));
}

export async function postCustomerRefund(params: ReceiptParams) {
  return postPlan(await planCustomerRefund(params));
}

export async function postExpensePaid(params: ExpenseParams) {
  return postPlan(await planExpensePaid(params));
}

/**
 * Receipt or refund plan for a CRM Payment document. Only "Received" payments
 * touch the ledger; a "Refund"-type payment moves money OUT.
 */
export async function planForPayment(
  p: {
    _id: unknown; paymentId?: string; studentName: string; course?: string; amount: number;
    paymentType?: string; paymentMethod?: string; status?: string; datePaid?: Date | null;
    enrollmentId?: unknown;
  },
  createdBy: string
): Promise<CreateJournalEntryInput | null> {
  if (p.status !== "Received") return null;
  const params: ReceiptParams = {
    sourceId: String(p._id),
    sourceNumber: p.paymentId ?? String(p._id),
    date: p.datePaid ?? new Date(),
    studentName: p.studentName,
    course: p.course,
    amount: p.amount,
    paymentMethod: p.paymentMethod ?? "Cash",
    asAdvance: !p.enrollmentId,
    enrollmentId: p.enrollmentId ? String(p.enrollmentId) : undefined,
    createdBy,
  };
  return p.paymentType === "Refund" ? planCustomerRefund(params) : planCustomerReceipt(params);
}

/** Journal source types a Payment document can own. */
export const PAYMENT_SOURCE_TYPES: JournalSourceType[] = ["Receipt", "Refund"];

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

// ── Keeping a CRM document and its ledger entry in step ─────────────────────

/**
 * Reverse the active posted entry for a CRM source document, if one exists.
 * Throws AccountingError if that entry is dated inside a locked period.
 */
export async function reverseEntryForSource(
  sourceType: string,
  sourceId: string,
  reversedBy: string,
  reason: string
) {
  const entry = await JournalEntry.findOne({ sourceType, sourceId, status: "Posted" }).lean();
  if (!entry) return null;
  return reverseJournalEntry(entry._id.toString(), reversedBy, reason);
}

export interface SyncResult<T> {
  result: T;
  /** The newly posted entry, if any. */
  entry: IJournalEntry | null;
  /** The entry that was reversed, if any. */
  reversed: IJournalEntry | null;
  /**
   * Set when the change and any reversal succeeded but posting the new entry
   * failed unexpectedly (everything predictable was checked up front). The
   * caller must record it on the document and tell the user.
   */
  postingError?: string;
}

/**
 * Change a CRM document and keep its ledger entry in step.
 *
 *  1. Validate the planned replacement entry and the lock date of the entry
 *     being replaced — nothing is written if either would be refused.
 *  2. Apply the document change and reverse the old entry, in the order the
 *     operation needs ("change-first" for edits, "reverse-first" for deletes,
 *     so a deleted document never leaves a live entry behind).
 *  3. Post the new entry.
 *
 * The active entry is found by querying the ledger, never from a link field on
 * the document, which can be stale.
 */
export async function syncSourceEntry<T>(opts: {
  sourceTypes: JournalSourceType[];
  sourceId: string;
  plan: CreateJournalEntryInput | null;
  /** false = the change doesn't affect money; the ledger is left alone */
  affectsLedger: boolean;
  actor: string;
  reason: string;
  order?: "change-first" | "reverse-first";
  applyChange: () => Promise<T>;
}): Promise<SyncResult<T>> {
  if (!opts.affectsLedger) {
    return { result: await opts.applyChange(), entry: null, reversed: null };
  }

  const active = await JournalEntry.findOne({
    sourceType: { $in: opts.sourceTypes },
    sourceId: opts.sourceId,
    status: "Posted",
  }).lean();

  // 1. Everything predictable is checked before any write
  if (opts.plan) await preflightJournalEntry(opts.plan);
  if (active) await assertOpenPeriod(active.date, "reverse an entry dated in");

  // 2. Change + reverse
  let result: T;
  let reversed: IJournalEntry | null = null;
  if (opts.order === "reverse-first") {
    if (active) reversed = await reverseJournalEntry(active._id.toString(), opts.actor, opts.reason);
    result = await opts.applyChange();
  } else {
    result = await opts.applyChange();
    if (active) reversed = await reverseJournalEntry(active._id.toString(), opts.actor, opts.reason);
  }

  // 3. Post the replacement
  if (!opts.plan) return { result, entry: null, reversed };
  try {
    const entry = await createJournalEntry(opts.plan);
    return { result, entry, reversed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "posting failed";
    console.error(`[accounting] posting failed for ${opts.sourceTypes.join("/")} ${opts.sourceId}:`, message);
    return { result, entry: null, reversed, postingError: message };
  }
}

/**
 * Post a new document's entry after the document was created. Predictable
 * failures should already have been caught with preflightJournalEntry; an
 * unexpected failure is returned (not thrown) so the caller can flag the
 * document instead of losing track of it.
 */
export async function postForNewDocument(
  plan: CreateJournalEntryInput | null
): Promise<{ entry: IJournalEntry | null; postingError?: string }> {
  if (!plan) return { entry: null };
  try {
    return { entry: await createJournalEntry(plan) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "posting failed";
    console.error(`[accounting] posting failed for ${plan.sourceType} ${plan.sourceId}:`, message);
    return { entry: null, postingError: message };
  }
}

/**
 * @deprecated Swallows posting failures, which is how CRM documents ended up
 * missing from the ledger with nobody told. Use preflightJournalEntry +
 * postForNewDocument / syncSourceEntry, which surface the failure.
 */
export async function postSafely<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[accounting] auto-post failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
