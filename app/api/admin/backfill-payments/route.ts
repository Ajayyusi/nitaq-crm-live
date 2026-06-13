import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { Payment } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { requireAuth } from "@/lib/api-auth";

function derivePaymentType(paymentStatus: string): string {
  if (paymentStatus === "Instalment 1 Paid" || paymentStatus === "Instalment 2 Pending") {
    return "Instalment 1 of 2";
  }
  return "Full Payment";
}

export async function POST() {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();

    const enrollments = await Enrollment.find({ amountPaid: { $gt: 0 } }).lean();
    let created = 0;
    let skipped = 0;

    for (const enrollment of enrollments) {
      const existingPayment = await Payment.findOne({ enrollmentId: enrollment._id });
      if (existingPayment) {
        skipped++;
        continue;
      }

      const seq = await getNextSequence("payment");
      const paymentId = `P-${String(seq).padStart(3, "0")}`;
      await Payment.create({
        paymentId,
        enrollmentId: enrollment._id,
        studentName: enrollment.fullName,
        studentPhone: enrollment.phone || undefined,
        course: enrollment.course || undefined,
        amount: enrollment.amountPaid,
        paymentType: derivePaymentType(enrollment.paymentStatus),
        paymentMethod: "Cash",
        status: "Received",
        datePaid: enrollment.registrationDate ?? enrollment.createdAt,
        notes: `Backfilled from enrollment ${enrollment.enrollmentId}`,
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete. Created ${created} payment(s), skipped ${skipped} enrollment(s) that already had payments.`,
      created,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backfill failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
