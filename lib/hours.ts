import Enrollment from "@/models/Enrollment";
import ClassSession from "@/models/ClassSession";
import HourAdjustment from "@/models/HourAdjustment";
import { notify } from "@/lib/notify";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Does this session consume the student's hours?
 * Completed + (Present/Late) always charges. Absent / No Show / Cancelled
 * charge ONLY when an admin explicitly marked the session chargeable.
 */
export function sessionCharges(s: {
  classStatus: string;
  attendanceStatus: string;
  isChargeable?: boolean;
}): boolean {
  if (s.classStatus === "Cancelled") return false;
  if (s.classStatus === "Completed" && (s.attendanceStatus === "Present" || s.attendanceStatus === "Late")) {
    return true;
  }
  // Absent / Excused / No Show — chargeable only on explicit admin override
  return !!s.isChargeable && s.classStatus !== "Scheduled";
}

/**
 * Recalculate a registration's completedHours from its session records and
 * manual adjustments (single source of truth — prevents drift), clamp so
 * remaining never goes negative, and fire low-hours / completion alerts.
 * Returns { completedHours, remainingHours } or null if not found.
 */
export async function recalcEnrollmentHours(enrollmentId: string) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) return null;

  const [sessions, adjustments] = await Promise.all([
    ClassSession.find({ enrollmentId }).select("classStatus attendanceStatus isChargeable deliveredHours").lean(),
    HourAdjustment.find({ enrollmentId }).select("adjustmentType hours").lean(),
  ]);

  let completed = 0;
  for (const s of sessions) {
    if (sessionCharges(s)) completed += s.deliveredHours ?? 0;
  }
  for (const a of adjustments) {
    // "Deduct Hours"/"Correction" count as consumed; "Add Hours" restores hours
    if (a.adjustmentType === "Add Hours") completed -= a.hours;
    else completed += a.hours;
  }

  const total = enrollment.totalRegisteredHours ?? 0;
  const prevCompleted = enrollment.completedHours ?? 0;
  completed = round2(Math.max(0, total > 0 ? Math.min(completed, total) : completed));
  const remaining = round2(Math.max(0, total - completed));

  enrollment.completedHours = completed;
  await enrollment.save();

  // Alerts on threshold crossings (only when hours are tracked)
  if (total > 0) {
    const prevRemaining = Math.max(0, total - prevCompleted);
    if (remaining <= 5 && prevRemaining > 5 && remaining > 0) {
      notify({
        roleTarget: "admin",
        title: `Low hours: ${enrollment.fullName}`,
        body: `${enrollment.course} — only ${remaining}h of ${total}h remaining.`,
        link: "/students",
      });
    }
    if (remaining === 0 && prevRemaining > 0) {
      notify({
        roleTarget: "admin",
        title: `Hours complete: ${enrollment.fullName}`,
        body: `${enrollment.course} — all ${total} registered hours delivered.`,
        link: "/students",
      });
    }
  }

  return { completedHours: completed, remainingHours: remaining };
}
