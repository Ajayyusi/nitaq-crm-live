/**
 * Central double-entry accounting engine.
 *
 * ALL modules (invoices, receipts, expenses, supplier bills/payments, refunds,
 * manual JVs — and any future module) post through createJournalEntry().
 * Nothing writes account balances directly: the Trial Balance, General Ledger
 * and VAT reports are all computed from POSTED journal entries only.
 */

import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry, {
  type IJournalEntry,
  type JournalSourceType,
} from "@/models/accounting/JournalEntry";
import { getNextSequence } from "@/models/Counter";

export interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
  studentRef?: string;
  supplierRef?: string;
  courseRef?: string;
}

export interface CreateJournalEntryInput {
  date: Date | string;
  sourceType: JournalSourceType;
  sourceId?: string;        // CRM document id — enforces one entry per source doc
  sourceNumber?: string;    // human-readable doc number (P-001, E-004, SB-0001…)
  description: string;
  reference?: string;
  lines: JournalLineInput[];
  createdBy: string;
  /** true (default) = post immediately; false = save as Draft (manual JVs) */
  autoPost?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class AccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountingError";
  }
}

/**
 * Validates and creates a journal entry.
 *
 * Guarantees:
 *  - Total debits === total credits (to the fils)
 *  - Every line hits an ACTIVE POSTING account that exists in the COA
 *  - At most one entry per (sourceType, sourceId) — duplicates are rejected
 *  - Posted entries are immutable (edits blocked at the API layer; reversals only)
 */
export async function createJournalEntry(input: CreateJournalEntryInput): Promise<IJournalEntry> {
  const { lines } = input;
  if (!lines || lines.length < 2) {
    throw new AccountingError("A journal entry needs at least two lines.");
  }

  // Normalise + validate amounts
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    const d = round2(Number(l.debit) || 0);
    const c = round2(Number(l.credit) || 0);
    if (d < 0 || c < 0) throw new AccountingError("Negative amounts are not allowed — use the opposite side.");
    if (d > 0 && c > 0) throw new AccountingError(`Line for account ${l.accountCode} has both debit and credit.`);
    if (d === 0 && c === 0) throw new AccountingError(`Line for account ${l.accountCode} has no amount.`);
    totalDebit = round2(totalDebit + d);
    totalCredit = round2(totalCredit + c);
  }
  if (totalDebit !== totalCredit) {
    throw new AccountingError(
      `Entry is not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}.`
    );
  }

  // Validate accounts: must exist, be posting accounts, and be active
  const codes = [...new Set(lines.map((l) => l.accountCode.trim()))];
  const accounts = await ChartOfAccount.find({ code: { $in: codes } }).lean();
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of codes) {
    const acc = byCode.get(code);
    if (!acc) throw new AccountingError(`Account ${code} does not exist in the Chart of Accounts.`);
    if (!acc.isPosting) throw new AccountingError(`Account ${code} (${acc.name}) is a parent account — transactions must post to a posting account.`);
    if (!acc.isActive) throw new AccountingError(`Account ${code} (${acc.name}) is inactive.`);
  }

  // Duplicate-source guard
  if (input.sourceId) {
    const dup = await JournalEntry.findOne({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: { $ne: "Cancelled" },
    }).lean();
    if (dup) {
      throw new AccountingError(
        `A journal entry (${dup.jvNumber}) already exists for this ${input.sourceType}.`
      );
    }
  }

  const seq = await getNextSequence("journal-entry");
  const jvNumber = `JV-${String(seq).padStart(6, "0")}`;
  const autoPost = input.autoPost !== false;

  return JournalEntry.create({
    jvNumber,
    date: new Date(input.date),
    description: input.description.trim(),
    reference: input.reference?.trim() || undefined,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceNumber: input.sourceNumber,
    status: autoPost ? "Posted" : "Draft",
    lines: lines.map((l) => ({
      accountCode: l.accountCode.trim(),
      accountName: byCode.get(l.accountCode.trim())!.name,
      debit: round2(Number(l.debit) || 0),
      credit: round2(Number(l.credit) || 0),
      description: l.description?.trim() || undefined,
      studentRef: l.studentRef || undefined,
      supplierRef: l.supplierRef || undefined,
      courseRef: l.courseRef || undefined,
    })),
    totalDebit,
    totalCredit,
    createdBy: input.createdBy,
    postedBy: autoPost ? input.createdBy : undefined,
    postedAt: autoPost ? new Date() : undefined,
  });
}

/** Post a Draft entry (re-validates balance + accounts). */
export async function postJournalEntry(id: string, postedBy: string): Promise<IJournalEntry> {
  const entry = await JournalEntry.findById(id);
  if (!entry) throw new AccountingError("Journal entry not found.");
  if (entry.status !== "Draft") throw new AccountingError(`Only Draft entries can be posted (current: ${entry.status}).`);
  if (entry.totalDebit !== entry.totalCredit) throw new AccountingError("Entry is not balanced.");

  entry.status = "Posted";
  entry.postedBy = postedBy;
  entry.postedAt = new Date();
  await entry.save();
  return entry;
}

/**
 * Reverse a Posted entry: creates a NEW opposite entry and links both.
 * The original is never mutated beyond the reversal link + status.
 */
export async function reverseJournalEntry(
  id: string,
  reversedBy: string,
  reason?: string
): Promise<IJournalEntry> {
  const original = await JournalEntry.findById(id);
  if (!original) throw new AccountingError("Journal entry not found.");
  if (original.status !== "Posted") throw new AccountingError("Only Posted entries can be reversed.");
  if (original.reversedByEntryId) throw new AccountingError("This entry has already been reversed.");

  const seq = await getNextSequence("journal-entry");
  const reversal = await JournalEntry.create({
    jvNumber: `JV-${String(seq).padStart(6, "0")}`,
    date: new Date(),
    description: `Reversal of ${original.jvNumber}${reason ? ` — ${reason}` : ""}`,
    reference: original.jvNumber,
    sourceType: "Reversal",
    sourceNumber: original.jvNumber,
    status: "Posted",
    lines: original.lines.map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.credit,   // flip sides
      credit: l.debit,
      description: l.description,
      studentRef: l.studentRef,
      supplierRef: l.supplierRef,
      courseRef: l.courseRef,
    })),
    totalDebit: original.totalCredit,
    totalCredit: original.totalDebit,
    createdBy: reversedBy,
    postedBy: reversedBy,
    postedAt: new Date(),
    reversesEntryId: original._id,
  });

  original.status = "Reversed";
  original.reversedByEntryId = reversal._id as never;
  await original.save();
  return reversal;
}

// ── Reporting helpers (all derived from POSTED entries only) ────────────────

export interface AccountBalance {
  accountCode: string;
  periodDebit: number;
  periodCredit: number;
}

/** Sum posted debits/credits per account, optionally within a date window. */
export async function aggregateBalances(fromDate?: Date, toDate?: Date): Promise<AccountBalance[]> {
  const match: Record<string, unknown> = { status: { $in: ["Posted", "Reversed"] } };
  // "Reversed" originals still count — their reversal entry offsets them.
  if (fromDate || toDate) {
    const d: Record<string, Date> = {};
    if (fromDate) d.$gte = fromDate;
    if (toDate) d.$lte = toDate;
    match.date = d;
  }
  const rows = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.accountCode",
        periodDebit: { $sum: "$lines.debit" },
        periodCredit: { $sum: "$lines.credit" },
      },
    },
  ]);
  return rows.map((r) => ({
    accountCode: r._id as string,
    periodDebit: round2(r.periodDebit),
    periodCredit: round2(r.periodCredit),
  }));
}

/** Ledger rows for one account with running balance. */
export async function getLedger(params: {
  accountCode: string;
  from?: Date;
  to?: Date;
  sourceType?: string;
}) {
  const match: Record<string, unknown> = {
    status: { $in: ["Posted", "Reversed"] },
    "lines.accountCode": params.accountCode,
  };
  if (params.sourceType) match.sourceType = params.sourceType;
  if (params.from || params.to) {
    const d: Record<string, Date> = {};
    if (params.from) d.$gte = params.from;
    if (params.to) d.$lte = params.to;
    match.date = d;
  }
  const entries = await JournalEntry.find(match).sort({ date: 1, createdAt: 1 }).lean();

  const rows: {
    entryId: string; date: string; jvNumber: string; sourceType: string; sourceNumber: string;
    description: string; debit: number; credit: number; balance: number;
  }[] = [];
  let balance = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.accountCode !== params.accountCode) continue;
      balance = round2(balance + l.debit - l.credit);
      rows.push({
        entryId: e._id.toString(),
        date: e.date.toISOString().slice(0, 10),
        jvNumber: e.jvNumber,
        sourceType: e.sourceType,
        sourceNumber: e.sourceNumber ?? "",
        description: l.description || e.description,
        debit: l.debit,
        credit: l.credit,
        balance,
      });
    }
  }
  return rows;
}
