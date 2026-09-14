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
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
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

// One-time migration: drop the legacy FULLY unique (sourceType, sourceId) index
// if it exists — it blocked reposting after a reversal. The partial unique
// index (Posted entries only) that replaced it must be left alone.
let indexChecked = false;
async function ensureNonUniqueSourceIndex() {
  if (indexChecked) return;
  indexChecked = true;
  try {
    const indexes = await JournalEntry.collection.indexes();
    const legacy = indexes.find(
      (i) => i.unique && !i.partialFilterExpression && i.key?.sourceType === 1 && i.key?.sourceId === 1
    );
    if (legacy?.name) await JournalEntry.collection.dropIndex(legacy.name);
  } catch { /* collection may not exist yet — fine */ }
}

function isDuplicateSourceError(err: unknown): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && !!e.keyPattern && "sourceId" in e.keyPattern;
}

function parseEntryDate(value: Date | string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AccountingError("Entry date is not a valid date.");
  return d;
}

export interface NormalisedLine {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  studentRef?: string;
  supplierRef?: string;
  courseRef?: string;
}

/**
 * The single set of line rules for every entry, whether created, edited as a
 * draft, or posted: at least two lines, finite non-negative amounts, one side
 * per line, no empty lines, and debits equal to credits to the fils.
 */
export function validateJournalLines(lines: JournalLineInput[] | undefined): {
  lines: NormalisedLine[];
  totalDebit: number;
  totalCredit: number;
} {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new AccountingError("A journal entry needs at least two lines.");
  }
  let totalDebit = 0;
  let totalCredit = 0;
  const out: NormalisedLine[] = [];
  for (const l of lines) {
    const code = String(l?.accountCode ?? "").trim();
    if (!code) throw new AccountingError("Every line needs an account.");
    const rawD = Number(l.debit ?? 0);
    const rawC = Number(l.credit ?? 0);
    if (!Number.isFinite(rawD) || !Number.isFinite(rawC)) {
      throw new AccountingError(`Line for account ${code} has an amount that is not a number.`);
    }
    const d = round2(rawD);
    const c = round2(rawC);
    if (d < 0 || c < 0) throw new AccountingError("Negative amounts are not allowed — use the opposite side.");
    if (d > 0 && c > 0) throw new AccountingError(`Line for account ${code} has both debit and credit.`);
    if (d === 0 && c === 0) throw new AccountingError(`Line for account ${code} has no amount.`);
    totalDebit = round2(totalDebit + d);
    totalCredit = round2(totalCredit + c);
    out.push({
      accountCode: code,
      debit: d,
      credit: c,
      description: typeof l.description === "string" ? l.description.trim() || undefined : undefined,
      studentRef: l.studentRef || undefined,
      supplierRef: l.supplierRef || undefined,
      courseRef: l.courseRef || undefined,
    });
  }
  if (totalDebit !== totalCredit) {
    throw new AccountingError(
      `Entry is not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}.`
    );
  }
  return { lines: out, totalDebit, totalCredit };
}

/** Accounts must exist, be posting (not parent) accounts, and be active. */
export async function loadPostingAccounts(codes: string[]) {
  const unique = [...new Set(codes)];
  const accounts = await ChartOfAccount.find({ code: { $in: unique } }).lean();
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of unique) {
    const acc = byCode.get(code);
    if (!acc) throw new AccountingError(`Account ${code} does not exist in the Chart of Accounts.`);
    if (!acc.isPosting) throw new AccountingError(`Account ${code} (${acc.name}) is a parent account — transactions must post to a posting account.`);
    if (!acc.isActive) throw new AccountingError(`Account ${code} (${acc.name}) is inactive.`);
  }
  return byCode;
}

/** Period lock: nothing may be posted, or un-posted, on or before the lock date. */
export async function assertOpenPeriod(date: Date, action = "post into") {
  const settings = await getAccountingSettings();
  if (settings.lockDate && date <= settings.lockDate) {
    throw new AccountingError(
      `Books are locked up to ${settings.lockDate.toISOString().slice(0, 10)} — cannot ${action} a locked period.`
    );
  }
}

async function assertNoActiveEntryForSource(sourceType: string, sourceId: string, exceptId?: unknown) {
  const filter: Record<string, unknown> = {
    sourceType,
    sourceId,
    status: { $nin: ["Cancelled", "Reversed"] },
  };
  if (exceptId) filter._id = { $ne: exceptId };
  const dup = await JournalEntry.findOne(filter).lean();
  if (dup) {
    throw new AccountingError(`A journal entry (${dup.jvNumber}) already exists for this ${sourceType}.`);
  }
}

/**
 * Run every check createJournalEntry would run, without writing anything.
 * Lets a CRM route refuse a change BEFORE it touches the document or reverses
 * an existing entry, instead of discovering half-way that the new entry can't
 * be posted (locked period, inactive account, unbalanced lines).
 */
export async function preflightJournalEntry(input: CreateJournalEntryInput): Promise<void> {
  const { lines } = validateJournalLines(input.lines);
  const date = parseEntryDate(input.date);
  await loadPostingAccounts(lines.map((l) => l.accountCode));
  await assertOpenPeriod(date);
}

/**
 * Validates and creates a journal entry.
 *
 * Guarantees:
 *  - Total debits === total credits (to the fils); amounts are finite
 *  - Every line hits an ACTIVE POSTING account that exists in the COA
 *  - At most one active entry per (sourceType, sourceId) — duplicates are
 *    rejected, and a unique partial index backs this for concurrent requests
 *  - Posted entries are immutable (edits blocked at the API layer; reversals only)
 */
export async function createJournalEntry(input: CreateJournalEntryInput): Promise<IJournalEntry> {
  await ensureNonUniqueSourceIndex();
  const { lines, totalDebit, totalCredit } = validateJournalLines(input.lines);
  const date = parseEntryDate(input.date);
  const byCode = await loadPostingAccounts(lines.map((l) => l.accountCode));
  await assertOpenPeriod(date);

  // Duplicate-source guard (Reversed/Cancelled entries don't block a repost)
  if (input.sourceId) await assertNoActiveEntryForSource(input.sourceType, input.sourceId);

  const seq = await getNextSequence("journal-entry");
  const jvNumber = `JV-${String(seq).padStart(6, "0")}`;
  const autoPost = input.autoPost !== false;

  try {
    return await JournalEntry.create({
      jvNumber,
      date,
      description: input.description.trim(),
      reference: input.reference?.trim() || undefined,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceNumber: input.sourceNumber,
      status: autoPost ? "Posted" : "Draft",
      lines: lines.map((l) => ({ ...l, accountName: byCode.get(l.accountCode)!.name })),
      totalDebit,
      totalCredit,
      createdBy: input.createdBy,
      postedBy: autoPost ? input.createdBy : undefined,
      postedAt: autoPost ? new Date() : undefined,
    });
  } catch (err) {
    // Lost a race with a concurrent posting for the same source document
    if (isDuplicateSourceError(err)) {
      throw new AccountingError(`A journal entry already exists for this ${input.sourceType}.`);
    }
    throw err;
  }
}

/**
 * Post a Draft entry. Re-runs every check createJournalEntry applies — a
 * draft can be edited (or the books locked) after it was saved, so its lines,
 * accounts, period and source must all be valid at the moment of posting.
 * The Draft → Posted switch is atomic, so a double-click posts once.
 */
export async function postJournalEntry(id: string, postedBy: string): Promise<IJournalEntry> {
  const entry = await JournalEntry.findById(id).lean();
  if (!entry) throw new AccountingError("Journal entry not found.");
  if (entry.status !== "Draft") throw new AccountingError(`Only Draft entries can be posted (current: ${entry.status}).`);

  const { totalDebit, totalCredit } = validateJournalLines(entry.lines);
  await loadPostingAccounts(entry.lines.map((l) => l.accountCode));
  await assertOpenPeriod(parseEntryDate(entry.date));
  if (entry.sourceId) await assertNoActiveEntryForSource(entry.sourceType, entry.sourceId, entry._id);

  try {
    const posted = await JournalEntry.findOneAndUpdate(
      { _id: entry._id, status: "Draft" },
      { $set: { status: "Posted", postedBy, postedAt: new Date(), totalDebit, totalCredit } },
      { new: true }
    );
    if (!posted) throw new AccountingError("This entry was already posted or changed — reload and try again.");
    return posted;
  } catch (err) {
    if (isDuplicateSourceError(err)) {
      throw new AccountingError(`A journal entry already exists for this ${entry.sourceType}.`);
    }
    throw err;
  }
}

/**
 * Reverse a Posted entry: creates a NEW opposite entry and links both.
 * The original is never mutated beyond the reversal link + status.
 *
 * Reports exclude both a reversed original and its reversal, so reversing an
 * entry removes it from the period it was dated in. That is why an entry
 * dated inside a locked period cannot be reversed.
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
  await assertOpenPeriod(original.date, "reverse an entry dated in");

  // Claim the original atomically: of two concurrent reversals only one wins.
  const claimed = await JournalEntry.findOneAndUpdate(
    { _id: original._id, status: "Posted", reversedByEntryId: null },
    { $set: { status: "Reversed" } },
    { new: true }
  );
  if (!claimed) throw new AccountingError("This entry has already been reversed.");

  let reversal: IJournalEntry;
  try {
    const seq = await getNextSequence("journal-entry");
    reversal = await JournalEntry.create({
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
  } catch (err) {
    // Release the claim so the entry is not left marked Reversed with no reversal
    await JournalEntry.updateOne(
      { _id: original._id, status: "Reversed", reversedByEntryId: null },
      { $set: { status: "Posted" } }
    );
    throw err;
  }

  await JournalEntry.updateOne({ _id: original._id }, { $set: { reversedByEntryId: reversal._id } });
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
  // Use the SAME "active only" filter as getLedger and the receivables/invoice
  // reports (status Posted, exclude Reversal entries). A reversed original is
  // excluded (status Reversed) and so is its reversal (sourceType Reversal),
  // netting to zero — identical to the ledger, so the Trial Balance always
  // reconciles with every other module by construction.
  const match: Record<string, unknown> = { status: "Posted", sourceType: { $ne: "Reversal" } };
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
  includeReversed?: boolean;
}) {
  // By default show only ACTIVE vouchers: exclude reversed originals
  // (status Reversed) and their reversal entries (sourceType Reversal).
  // Both nets to zero, so the running balance is unaffected. includeReversed
  // brings them back for audit.
  const match: Record<string, unknown> = {
    "lines.accountCode": params.accountCode,
  };
  if (params.includeReversed) {
    match.status = { $in: ["Posted", "Reversed"] };
  } else {
    match.status = "Posted";
    match.sourceType = { $ne: "Reversal" };
  }
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
