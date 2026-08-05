import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { Payment } from "@/models/Financial";
import { requireAuth } from "@/lib/api-auth";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Money to collect: every registration with an outstanding balance, enriched
 * with the last payment date and how long it has been outstanding, so staff
 * can chase in priority order.
 */
export async function GET() {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();

  const enrollments = await Enrollment.find({
    status: { $ne: "Dropped" },
    $expr: { $gt: ["$totalFee", "$amountPaid"] },
  })
    .select("enrollmentId fullName phone email course totalFee amountPaid paymentStatus status registrationDate startDate")
    .lean();

  // Last received payment per student (for "last paid" + chase priority)
  const lastPayments = await Payment.aggregate([
    { $match: { status: "Received" } },
    { $sort: { datePaid: -1 } },
    { $group: { _id: "$enrollmentId", lastPaid: { $first: "$datePaid" } } },
  ]);
  const lastMap = new Map(lastPayments.map((p) => [String(p._id), p.lastPaid as Date]));

  const now = Date.now();
  const rows = enrollments.map((e) => {
    const balance = round2((e.totalFee ?? 0) - (e.amountPaid ?? 0));
    const lastPaid = lastMap.get(String(e._id)) ?? null;
    // Age from the last payment, else from registration
    const since = lastPaid ?? e.registrationDate ?? e.startDate ?? null;
    const daysSince = since ? Math.floor((now - new Date(since).getTime()) / 86400000) : null;
    return {
      id: e._id.toString(),
      enrollmentId: e.enrollmentId ?? "",
      fullName: e.fullName,
      phone: e.phone ?? "",
      email: e.email ?? "",
      course: e.course ?? "",
      totalFee: e.totalFee ?? 0,
      amountPaid: e.amountPaid ?? 0,
      balanceDue: balance,
      paymentStatus: e.paymentStatus ?? "",
      status: e.status ?? "",
      lastPaid: lastPaid ? new Date(lastPaid).toISOString().slice(0, 10) : "",
      daysSince,
      isOverdue: e.paymentStatus === "Overdue" || (daysSince !== null && daysSince > 30),
    };
  });

  // Chase order: overdue first, then longest outstanding, then biggest balance
  rows.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if ((b.daysSince ?? 0) !== (a.daysSince ?? 0)) return (b.daysSince ?? 0) - (a.daysSince ?? 0);
    return b.balanceDue - a.balanceDue;
  });

  return NextResponse.json({
    rows,
    totals: {
      count: rows.length,
      outstanding: round2(rows.reduce((s, r) => s + r.balanceDue, 0)),
      overdueCount: rows.filter((r) => r.isOverdue).length,
      overdueAmount: round2(rows.filter((r) => r.isOverdue).reduce((s, r) => s + r.balanceDue, 0)),
    },
  });
}
