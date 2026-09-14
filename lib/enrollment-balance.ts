import Enrollment from "@/models/Enrollment";

const round2 = (n: number) => Math.round(n * 100) / 100;

type PaymentFacts = {
  enrollmentId?: unknown;
  status?: string;
  paymentType?: string;
  amount?: number;
} | null;

/**
 * How much a payment contributes to its enrollment's `amountPaid`:
 * Received money counts, a Received refund counts negative, anything else
 * (Pending, Overdue, Refunded, unlinked) counts nothing.
 */
export function paidContribution(p: PaymentFacts): number {
  if (!p || !p.enrollmentId || p.status !== "Received") return 0;
  const amount = Number(p.amount) || 0;
  return p.paymentType === "Refund" ? -amount : amount;
}

/**
 * Keep Enrollment.amountPaid in step with a payment that was created, edited
 * or deleted from the Payments page.
 *
 * Collections, Finance, Reports and the dashboard all compute a student's
 * balance as totalFee − amountPaid, but only enrollment-form edits used to
 * move amountPaid — so a receipt recorded on the Payments page left the
 * student showing as owing. The adjustment is applied as a server-side
 * increment (rounded to the fils) so concurrent payments can't lose updates.
 *
 * Payments auto-created BY the enrollment form must not call this — that form
 * already sets amountPaid itself.
 */
export async function applyPaymentToEnrollment(before: PaymentFacts, after: PaymentFacts): Promise<void> {
  const beforeId = before?.enrollmentId ? String(before.enrollmentId) : null;
  const afterId = after?.enrollmentId ? String(after.enrollmentId) : null;

  const deltas = new Map<string, number>();
  if (beforeId) deltas.set(beforeId, (deltas.get(beforeId) ?? 0) - paidContribution(before));
  if (afterId) deltas.set(afterId, (deltas.get(afterId) ?? 0) + paidContribution(after));

  for (const [enrollmentId, delta] of deltas) {
    const d = round2(delta);
    if (d === 0) continue;
    await Enrollment.updateOne({ _id: enrollmentId }, [
      { $set: { amountPaid: { $round: [{ $add: [{ $ifNull: ["$amountPaid", 0] }, d] }, 2] } } },
    ]);
  }
}
