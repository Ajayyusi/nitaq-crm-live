import ClassSession from "@/models/ClassSession";
import Enrollment from "@/models/Enrollment";
import type { ITeacher } from "@/models/Teacher";

const round2 = (n: number) => Math.round(n * 100) / 100;

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
    return {
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
