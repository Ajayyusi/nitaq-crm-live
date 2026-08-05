import ClassSession from "@/models/ClassSession";
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
}

/**
 * Compute what a teacher is owed for everything not yet settled.
 * "Monthly" teachers aren't paid per session, so their suggestion is simply
 * their monthly rate — the hours are shown for oversight only.
 */
export async function previewTeacherPayout(teacher: ITeacher): Promise<PayoutPreview> {
  const sessions = await ClassSession.find({
    teacherId: teacher._id,
    $or: [{ payoutId: null }, { payoutId: { $exists: false } }],
  })
    .select("classStatus deliveredHours classDate enrollmentId course")
    .sort({ classDate: 1 })
    .lean();

  const payable = sessions.filter(sessionPaysTeacher);
  const totalHours = round2(payable.reduce((s, x) => s + (x.deliveredHours ?? 0), 0));
  const courseKeys = new Set(payable.map((s) => `${String(s.enrollmentId)}`));
  const rate = teacher.paymentRate ?? 0;
  const basisRaw = teacher.paymentType ?? "Per Hour";
  // Legacy "Per Session" behaves exactly like "Per Class"
  const basis = basisRaw === "Per Session" ? "Per Class" : basisRaw;

  let quantity = 0;
  let quantityLabel = "";
  let suggestedAmount = 0;
  let note = "";

  switch (basis) {
    case "Per Hour":
      quantity = totalHours;
      quantityLabel = `${totalHours} hour${totalHours === 1 ? "" : "s"}`;
      suggestedAmount = round2(totalHours * rate);
      break;
    case "Per Class":
      quantity = payable.length;
      quantityLabel = `${payable.length} class${payable.length === 1 ? "" : "es"}`;
      suggestedAmount = round2(payable.length * rate);
      break;
    case "Per Course":
      quantity = courseKeys.size;
      quantityLabel = `${courseKeys.size} course${courseKeys.size === 1 ? "" : "s"}`;
      suggestedAmount = round2(courseKeys.size * rate);
      note = "Per-course pay is estimated from the distinct student courses taught in this batch — check the amount before paying.";
      break;
    case "Monthly":
      quantity = 1;
      quantityLabel = "1 month";
      suggestedAmount = round2(rate);
      note = "Monthly salary — the hours below are for oversight, not part of the calculation.";
      break;
    default:
      quantity = totalHours;
      quantityLabel = `${totalHours} hours`;
      suggestedAmount = round2(totalHours * rate);
  }

  if (!rate) note = "No pay rate is set on this trainer's profile — set it on the Trainers page.";

  const dates = payable.map((s) => new Date(s.classDate).getTime()).filter(Boolean);
  return {
    sessionIds: payable.map((s) => String(s._id)),
    sessionCount: payable.length,
    totalHours,
    courseCount: courseKeys.size,
    basis,
    rate,
    quantity,
    quantityLabel,
    suggestedAmount,
    periodFrom: dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : "",
    periodTo: dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : "",
    note,
  };
}
