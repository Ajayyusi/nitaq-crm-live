import mongoose from "mongoose";
import ClassSession from "@/models/ClassSession";
import Enrollment from "@/models/Enrollment";
import Teacher, { type ITeacher } from "@/models/Teacher";
import TeacherPayout, { type ITeacherPayout } from "@/models/TeacherPayout";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { getNextSequence } from "@/models/Counter";
import { assertOpenPeriod, createJournalEntry, loadPostingAccounts } from "@/lib/accounting/engine";
import type { IJournalEntry } from "@/models/accounting/JournalEntry";
import { MoneyInputError, parseAmount } from "@/lib/money";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Business timezone. Month boundaries for salaries follow UAE time, not UTC. */
const BUSINESS_TZ = "Asia/Dubai";

/** "YYYY-MM" of a moment, as seen on a UAE calendar. */
export function businessMonthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

export class PayrollError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "PayrollError";
  }
}

/**
 * Does this session count toward the TEACHER's pay?
 *
 * Deliberately different from what the STUDENT is charged: an Absent or
 * No Show still pays the teacher (they showed up and held the slot), while
 * a Cancelled class does not. Scheduled (not yet taught) never pays.
 */
export function sessionPaysTeacher(s: { classStatus: string }): boolean {
  return s.classStatus === "Completed" || s.classStatus === "No Show";
}

/** One registration's contribution to a payout. */
export interface PayoutLine {
  enrollmentId: string;
  enrollmentRef: string;      // human-readable E-001
  studentName: string;
  course: string;
  basis: string;              // Per Hour | Per Class | Fixed for Course
  rate: number;
  quantity: number;           // hours, classes, or 1 for a fixed course fee
  quantityLabel: string;
  sessionCount: number;
  hours: number;
  amount: number;
  /** Where the rate came from — the registration, or the trainer's default. */
  source: "enrollment" | "teacher";
  note?: string;
}

export interface PayoutPreview {
  sessionIds: string[];
  sessionCount: number;
  totalHours: number;
  courseCount: number;
  basis: string;
  rate: number;
  quantity: number;
  quantityLabel: string;
  suggestedAmount: number;
  periodFrom: string;
  periodTo: string;
  note: string;
  /** Per-registration breakdown — empty for monthly trainers. */
  lines: PayoutLine[];
  /** True when more than one rate or basis applies in this batch. */
  mixed: boolean;
  /** Monthly trainers only: the current UAE month and whether it is already paid. */
  salaryPeriod?: { current: string; paid: boolean; payoutNumber?: string };
}

/** Legacy "Per Session" behaves exactly like "Per Class". */
function normalizeBasis(b?: string): string {
  return b === "Per Session" ? "Per Class" : (b ?? "Per Hour");
}

/**
 * Compute what a teacher is owed for everything not yet settled.
 *
 * Pay is resolved PER REGISTRATION: a registration that carries its own
 * teacherPayRate is paid at that rate, otherwise the trainer's default rate
 * applies. That keeps existing data paying exactly as it did before
 * per-registration rates existed.
 *
 * "Monthly" trainers are paid a flat salary and are not itemised — any
 * per-registration rate is ignored for them (and called out in the note).
 */
export async function previewTeacherPayout(teacher: ITeacher): Promise<PayoutPreview> {
  const sessions = await ClassSession.find({
    teacherId: teacher._id,
    $or: [{ payoutId: null }, { payoutId: { $exists: false } }],
  })
    .select("classStatus deliveredHours classDate enrollmentId course studentName")
    .sort({ classDate: 1 })
    .lean();

  const payable = sessions.filter(sessionPaysTeacher);
  const totalHours = round2(payable.reduce((s, x) => s + (x.deliveredHours ?? 0), 0));
  const teacherRate = teacher.paymentRate ?? 0;
  const teacherBasis = normalizeBasis(teacher.paymentType);

  const dates = payable.map((s) => new Date(s.classDate).getTime()).filter(Boolean);
  const period = {
    periodFrom: dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : "",
    periodTo: dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : "",
  };
  const sessionIds = payable.map((s) => String(s._id));

  // ── Group the outstanding sessions by registration ──────────────────────
  const groups = new Map<string, typeof payable>();
  for (const s of payable) {
    const key = String(s.enrollmentId);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  // ── Monthly trainers: flat salary, never itemised ───────────────────────
  if (teacherBasis === "Monthly") {
    const enrollments = await Enrollment.find({ _id: { $in: [...groups.keys()] } })
      .select("teacherPayRate")
      .lean();
    const hasOverrides = enrollments.some((e) => (e.teacherPayRate ?? 0) > 0);
    let note = "Monthly salary — the hours below are for oversight, not part of the calculation.";
    if (hasOverrides) {
      note += " Per-registration rates are ignored for monthly trainers.";
    }
    if (!teacherRate) {
      note = "No monthly salary is set on this trainer's profile — set it on the Trainers page.";
    }
    const current = businessMonthKey(new Date());
    const paidThisMonth = await TeacherPayout.findOne({ teacherId: teacher._id, periodKey: current })
      .select("payoutNumber")
      .lean();
    if (paidThisMonth) {
      note = `Salary for ${current} was already paid (${paidThisMonth.payoutNumber}). ${note}`;
    }
    return {
      salaryPeriod: { current, paid: !!paidThisMonth, payoutNumber: paidThisMonth?.payoutNumber },
      sessionIds,
      sessionCount: payable.length,
      totalHours,
      courseCount: groups.size,
      basis: "Monthly",
      rate: teacherRate,
      quantity: 1,
      quantityLabel: "1 month",
      suggestedAmount: round2(teacherRate),
      ...period,
      note,
      lines: [],
      mixed: false,
    };
  }

  // ── Per-registration resolution ─────────────────────────────────────────
  const enrollments = await Enrollment.find({ _id: { $in: [...groups.keys()] } })
    .select("enrollmentId fullName course teacherPayRate teacherPayBasis")
    .lean();
  const byId = new Map(enrollments.map((e) => [String(e._id), e]));

  const lines: PayoutLine[] = [];
  const notes: string[] = [];
  let missingRate = false;

  for (const [enrollmentId, group] of groups) {
    const enrollment = byId.get(enrollmentId);
    const ownRate = enrollment?.teacherPayRate ?? 0;
    const usesOwnRate = ownRate > 0;
    const rate = usesOwnRate ? ownRate : teacherRate;
    const basis = usesOwnRate ? normalizeBasis(enrollment?.teacherPayBasis) : teacherBasis;

    const hours = round2(group.reduce((s, x) => s + (x.deliveredHours ?? 0), 0));
    const sessionCount = group.length;

    let quantity: number;
    let quantityLabel: string;
    let amount: number;
    let lineNote: string | undefined;

    if (basis === "Fixed for Course" || basis === "Per Course") {
      // A fixed course fee is paid once. If any session of this registration
      // was already settled, the fee went out with that payout.
      const alreadySettled = await ClassSession.exists({
        enrollmentId,
        payoutId: { $nin: [null, undefined] },
      });
      quantity = alreadySettled ? 0 : 1;
      quantityLabel = alreadySettled ? "course fee already paid" : "1 course (fixed)";
      amount = alreadySettled ? 0 : round2(rate);
      if (alreadySettled) {
        lineNote = "Fixed course fee already paid in an earlier payout.";
        notes.push(
          `${enrollment?.fullName ?? "A student"} · ${enrollment?.course ?? ""}: fixed course fee was already paid — only new hours would be extra.`
        );
      }
    } else if (basis === "Per Class") {
      quantity = sessionCount;
      quantityLabel = `${sessionCount} class${sessionCount === 1 ? "" : "es"}`;
      amount = round2(sessionCount * rate);
    } else {
      quantity = hours;
      quantityLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
      amount = round2(hours * rate);
    }

    if (!rate) missingRate = true;

    lines.push({
      enrollmentId,
      enrollmentRef: enrollment?.enrollmentId ?? "",
      studentName: enrollment?.fullName ?? group[0]?.studentName ?? "Unknown student",
      course: enrollment?.course ?? group[0]?.course ?? "",
      basis,
      rate,
      quantity,
      quantityLabel,
      sessionCount,
      hours,
      amount,
      source: usesOwnRate ? "enrollment" : "teacher",
      note: lineNote,
    });
  }

  lines.sort((a, b) => b.amount - a.amount);

  const suggestedAmount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const distinctRates = new Set(lines.map((l) => `${l.basis}:${l.rate}`));
  const mixed = distinctRates.size > 1;

  if (missingRate) {
    notes.unshift(
      "No pay rate is set for at least one registration, and the trainer has no default rate — set a rate on the registration or on the Trainers page."
    );
  } else if (mixed) {
    notes.unshift("This batch mixes rates — see the breakdown below.");
  }

  return {
    sessionIds,
    sessionCount: payable.length,
    totalHours,
    courseCount: groups.size,
    basis: mixed ? "Mixed" : (lines[0]?.basis ?? teacherBasis),
    rate: mixed ? 0 : (lines[0]?.rate ?? teacherRate),
    quantity: mixed ? lines.length : (lines[0]?.quantity ?? 0),
    quantityLabel: mixed
      ? `${lines.length} registration${lines.length === 1 ? "" : "s"}`
      : (lines[0]?.quantityLabel ?? "nothing outstanding"),
    suggestedAmount,
    ...period,
    note: notes.join(" "),
    lines,
    mixed,
  };
}

// ── Settlement ──────────────────────────────────────────────────────────────

export interface SettlePayoutInput {
  teacherId: string;
  amount: unknown;
  adjustmentReason?: unknown;
  paidDate?: unknown;
  expenseAccountCode?: unknown;
  paymentAccountCode?: unknown;
  /** Monthly trainers: the salary month being paid (YYYY-MM). Defaults to the UAE month of paidDate. */
  periodMonth?: unknown;
  notes?: unknown;
  createdBy: string;
}

export interface SettlePayoutResult {
  payout: ITeacherPayout;
  entry: IJournalEntry;
  teacher: ITeacher;
  preview: PayoutPreview;
  amount: number;
  adjusted: boolean;
  adjustmentReason: string;
}

function resolvePeriodKey(raw: unknown, paidDate: Date): string {
  const text = String(raw ?? "").trim();
  if (!text) return businessMonthKey(paidDate);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    throw new PayrollError("Salary month must be in the form YYYY-MM.");
  }
  return text;
}

/**
 * Mark a teacher paid.
 *
 * Order matters, because nothing here runs in a transaction:
 *  1. Recompute what is owed server-side and validate EVERYTHING the ledger
 *     will check (amount, date, accounts, lock date, salary period) before
 *     any write, so a bad input fails cleanly instead of after the payout exists.
 *  2. Create the payout, then CLAIM its sessions with a conditional update
 *     (`payoutId: null`). Two concurrent requests compute the same session
 *     list, but only one can claim them; the loser is rolled back with 409.
 *     Previously both succeeded and the trainer was paid twice.
 *  3. Post the journal entry. If that fails, the claim and payout are rolled
 *     back so no session is left marked paid with nothing in the ledger.
 */
export async function settleTeacherPayout(input: SettlePayoutInput): Promise<SettlePayoutResult> {
  if (!mongoose.Types.ObjectId.isValid(input.teacherId)) {
    throw new PayrollError("Valid teacher is required.");
  }
  const teacher = await Teacher.findById(input.teacherId);
  if (!teacher) throw new PayrollError("Teacher not found.", 404);

  const preview = await previewTeacherPayout(teacher);

  let amount: number;
  try {
    amount = parseAmount(input.amount);
  } catch (err) {
    if (err instanceof MoneyInputError) throw new PayrollError(err.message);
    throw err;
  }
  if (preview.sessionCount === 0 && preview.basis !== "Monthly") {
    throw new PayrollError("This trainer has no unsettled sessions.");
  }

  const adjusted = Math.abs(amount - preview.suggestedAmount) > 0.009;
  const adjustmentReason = String(input.adjustmentReason ?? "").trim();
  if (adjusted && adjustmentReason.length < 3) {
    throw new PayrollError(
      `Amount differs from the calculated ${preview.suggestedAmount.toFixed(2)} — a reason is required.`
    );
  }

  const paidDate = input.paidDate ? new Date(String(input.paidDate)) : new Date();
  if (Number.isNaN(paidDate.getTime())) throw new PayrollError("Payment date is not a valid date.");

  const settings = await getAccountingSettings();
  const expenseAccountCode = String(input.expenseAccountCode ?? "").trim()
    || settings.teacherSalaryAccount || settings.defaultExpenseAccount;
  const paymentAccountCode = String(input.paymentAccountCode ?? "").trim() || settings.defaultCashAccount;
  if (!expenseAccountCode || !paymentAccountCode) {
    throw new PayrollError("Set the salary and payment accounts in Accounting Settings first.");
  }

  // Everything the journal entry will check, checked before any write.
  const accounts = await loadPostingAccounts([expenseAccountCode, paymentAccountCode]);
  const expenseAcc = accounts.get(expenseAccountCode)!;
  const paymentAcc = accounts.get(paymentAccountCode)!;
  if (expenseAcc.type !== "Expense") {
    throw new PayrollError(`Account ${expenseAccountCode} (${expenseAcc.name}) is not an expense account.`);
  }
  if (
    (paymentAcc.type !== "Asset" && paymentAcc.type !== "Liability") ||
    paymentAcc.mainAccount === "ACCOUNTS RECEIVABLES"
  ) {
    throw new PayrollError(`Account ${paymentAccountCode} (${paymentAcc.name}) cannot be used to pay a trainer.`);
  }
  await assertOpenPeriod(paidDate);

  const periodKey = preview.basis === "Monthly" ? resolvePeriodKey(input.periodMonth, paidDate) : undefined;
  if (periodKey) {
    const already = await TeacherPayout.findOne({ teacherId: teacher._id, periodKey }).select("payoutNumber").lean();
    if (already) {
      throw new PayrollError(
        `${teacher.fullName}'s salary for ${periodKey} was already paid (${already.payoutNumber}).`, 409
      );
    }
  }

  const seq = await getNextSequence("teacher-payout");
  const payoutNumber = `TP-${String(seq).padStart(4, "0")}`;

  let payout: ITeacherPayout;
  try {
    payout = await TeacherPayout.create({
      payoutNumber,
      teacherId: teacher._id,
      teacherName: teacher.fullName,
      sessionIds: preview.sessionIds,
      periodFrom: preview.periodFrom ? new Date(preview.periodFrom) : undefined,
      periodTo: preview.periodTo ? new Date(preview.periodTo) : undefined,
      periodKey,
      basis: preview.basis,
      rate: preview.rate,
      quantity: preview.quantity,
      // Snapshot the per-registration breakdown so a payout stays auditable
      // even after a registration's rate is later changed.
      lines: preview.lines.length
        ? preview.lines.map((l) => ({
            enrollmentRef: l.enrollmentRef,
            studentName: l.studentName,
            course: l.course,
            basis: l.basis,
            rate: l.rate,
            quantity: l.quantity,
            sessionCount: l.sessionCount,
            hours: l.hours,
            amount: l.amount,
            source: l.source,
          }))
        : undefined,
      sessionCount: preview.sessionCount,
      totalHours: preview.totalHours,
      suggestedAmount: preview.suggestedAmount,
      amount,
      adjustmentReason: adjusted ? adjustmentReason : undefined,
      paidDate,
      expenseAccountCode,
      paymentAccountCode,
      notes: String(input.notes ?? "").trim() || undefined,
      createdBy: input.createdBy,
    });
  } catch (err) {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e?.code === 11000 && e.keyPattern && "periodKey" in e.keyPattern) {
      throw new PayrollError(`${teacher.fullName}'s salary for ${periodKey} was already paid.`, 409);
    }
    throw err;
  }

  const release = async () => {
    await ClassSession.updateMany({ payoutId: payout._id }, { $set: { payoutId: null } });
    await TeacherPayout.deleteOne({ _id: payout._id });
  };

  if (preview.sessionIds.length > 0) {
    // Only sessions still unpaid AND still payable can be claimed. If another
    // payout got there first (or a session was cancelled meanwhile), the
    // counts differ and this payout is abandoned.
    const claim = await ClassSession.updateMany(
      {
        _id: { $in: preview.sessionIds },
        teacherId: teacher._id,
        payoutId: null,
        classStatus: { $in: ["Completed", "No Show"] },
      },
      { $set: { payoutId: payout._id } }
    );
    if (claim.modifiedCount !== preview.sessionIds.length) {
      await release();
      throw new PayrollError(
        "Some of these sessions were just paid or changed by someone else — refresh and try again.", 409
      );
    }
  }

  let entry: IJournalEntry;
  try {
    entry = await createJournalEntry({
      date: paidDate,
      sourceType: "Expense",
      sourceId: payout._id.toString(),
      sourceNumber: payoutNumber,
      description: `Teacher payment — ${teacher.fullName} (${periodKey ? `salary ${periodKey}` : preview.quantityLabel})`,
      reference: payoutNumber,
      lines: [
        { accountCode: expenseAccountCode, debit: amount, description: `${teacher.fullName} · ${preview.quantityLabel}` },
        { accountCode: paymentAccountCode, credit: amount, description: `Paid to ${teacher.fullName}` },
      ],
      createdBy: input.createdBy,
    });
  } catch (err) {
    await release();
    throw err;
  }

  payout.journalEntryId = entry._id as never;
  await payout.save();

  return { payout, entry, teacher, preview, amount, adjusted, adjustmentReason };
}

const FIXED_BASES = new Set(["Fixed for Course", "Per Course"]);

/**
 * Why a registration's trainer rate/basis may not change right now, or null.
 *
 * A fixed course fee is paid once — the "already paid" check looks for any
 * settled session on the registration. Moving such a registration to (or away
 * from) a fixed basis after something was paid silently re-pays the fee, or
 * converts the rest of the course to hourly pay on top of it. Hourly and
 * per-class rate changes stay allowed: they only affect unpaid sessions.
 */
export async function payRateChangeBlockedReason(
  enrollmentId: string,
  before: { teacherPayRate?: number | null; teacherPayBasis?: string | null },
  after: { teacherPayRate?: number | null; teacherPayBasis?: string | null }
): Promise<string | null> {
  const paid = await ClassSession.find({ enrollmentId, payoutId: { $ne: null } })
    .select("teacherId")
    .lean();
  if (paid.length === 0) return null;

  const teacherIds = [...new Set(paid.map((s) => String(s.teacherId ?? "")).filter(Boolean))];
  const teachers = await Teacher.find({ _id: { $in: teacherIds } }).select("paymentRate paymentType").lean();

  // Mirrors previewTeacherPayout's per-registration resolution.
  const resolve = (
    own: { teacherPayRate?: number | null; teacherPayBasis?: string | null },
    t: { paymentRate?: number; paymentType?: string }
  ) =>
    (own.teacherPayRate ?? 0) > 0
      ? { rate: own.teacherPayRate ?? 0, basis: normalizeBasis(own.teacherPayBasis ?? undefined) }
      : { rate: t.paymentRate ?? 0, basis: normalizeBasis(t.paymentType) };

  for (const t of teachers) {
    if (normalizeBasis(t.paymentType) === "Monthly") continue; // registration rates don't apply
    const was = resolve(before, t);
    const now = resolve(after, t);
    const touchesFixed = FIXED_BASES.has(was.basis) || FIXED_BASES.has(now.basis);
    if (touchesFixed && (was.basis !== now.basis || was.rate !== now.rate)) {
      return (
        "Trainer pay has already been settled on this registration under a fixed course fee, so its " +
        "rate and basis can't be changed — that would pay the fee again or leave it unpaid. " +
        "Record any correction as an adjustment on the trainer's next payout."
      );
    }
  }
  return null;
}
