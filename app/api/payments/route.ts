import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Payment } from "@/models/Financial";
import { paymentMethods, paymentTypes, txStatuses } from "@/models/Financial";
import Enrollment from "@/models/Enrollment";
import { getNextSequence } from "@/models/Counter";
import { serializePayment } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { parseAmount } from "@/lib/money";
import { apiError } from "@/lib/api-error";
import { parseOptionalDate } from "@/lib/mongo-update";
import { preflightJournalEntry } from "@/lib/accounting/engine";
import { planForPayment, postForNewDocument } from "@/lib/accounting/postings";
import { applyPaymentToEnrollment } from "@/lib/enrollment-balance";

const allowedMethods = new Set<string>(paymentMethods);
const allowedTypes = new Set<string>(paymentTypes);
const allowedStatuses = new Set<string>(txStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const method = searchParams.get("method")?.trim();
    const search = searchParams.get("search")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: Record<string, unknown> = {};
    if (status && allowedStatuses.has(status)) query.status = status;
    if (method && allowedMethods.has(method)) query.paymentMethod = method;
    if (from || to) {
      const dateQ: Record<string, Date> = {};
      if (from) dateQ.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); dateQ.$lt = t; }
      query.datePaid = dateQ;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ studentName: regex }, { paymentId: regex }, { receiptRef: regex }];
    }

    const payments = await Payment.find(query).sort({ datePaid: -1, createdAt: -1 }).lean();
    const totalRevenue = payments.filter((p) => p.status === "Received" && p.paymentType !== "Refund").reduce((s, p) => s + (p.amount ?? 0), 0);
    const totalPending = payments.filter((p) => p.status === "Pending" || p.status === "Overdue").reduce((s, p) => s + (p.amount ?? 0), 0);

    return NextResponse.json({ payments: payments.map(serializePayment), totalRevenue, totalPending });
  } catch (error) {
    return apiError(error, "Failed to load payments.", "payments");
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const body = await request.json();

    const studentName = clean(body.studentName);
    if (!studentName) throw new Error("Student name is required.");
    const amount = parseAmount(body.amount);

    const paymentMethod = clean(body.paymentMethod) || "Cash";
    const paymentType = clean(body.paymentType) || "Full Payment";
    const status = clean(body.status) || "Received";

    if (!allowedMethods.has(paymentMethod)) throw new Error("Invalid payment method.");
    if (!allowedTypes.has(paymentType)) throw new Error("Invalid payment type.");
    if (!allowedStatuses.has(status)) throw new Error("Invalid status.");

    let enrollmentId: string | undefined;
    if (body.enrollmentId) {
      enrollmentId = String(body.enrollmentId);
      if (!mongoose.Types.ObjectId.isValid(enrollmentId) || !(await Enrollment.exists({ _id: enrollmentId }))) {
        throw new Error("The linked enrollment does not exist.");
      }
    }

    // Money that was received has a date. Without one the payment was missing
    // from every date-filtered report while its ledger entry used "today".
    const datePaid = parseOptionalDate(body.datePaid, "Payment date") ?? (status === "Received" ? new Date() : undefined);

    const installmentNumber = body.installmentNumber ? Number(body.installmentNumber) : undefined;
    const totalInstallments = body.totalInstallments ? Number(body.totalInstallments) : undefined;

    const seq = await getNextSequence("payment");
    const paymentId = `P-${String(seq).padStart(3, "0")}`;

    const payment = new Payment({
      paymentId,
      studentName,
      studentPhone: clean(body.studentPhone) || undefined,
      course: clean(body.course) || undefined,
      amount,
      paymentType,
      paymentMethod,
      status,
      datePaid,
      dueDate: parseOptionalDate(body.dueDate, "Due date"),
      receiptRef: clean(body.receiptRef) || undefined,
      notes: clean(body.notes) || undefined,
      recordedBy: authed.name || undefined,
      enrollmentId,
      installmentNumber: installmentNumber && installmentNumber >= 1 ? installmentNumber : undefined,
      totalInstallments: totalInstallments && totalInstallments >= 1 ? totalInstallments : undefined,
    });

    // Auto double-entry: a receipt (Dr money / Cr A/R or Fees Advance) or, for
    // a refund, money out. Checked BEFORE saving: a payment the ledger would
    // refuse (e.g. dated in a locked period) is refused, instead of being saved
    // with no entry as it used to be.
    const plan = await planForPayment(payment, authed.name);
    if (plan) await preflightJournalEntry(plan);

    await payment.save();
    const { entry, postingError } = await postForNewDocument(plan);
    if (entry || postingError) {
      if (entry) payment.journalEntryId = entry._id as never;
      if (postingError) payment.postingError = postingError;
      await payment.save();
    }
    await applyPaymentToEnrollment(null, payment);

    await logAudit({
      userName: authed.name, userRole: authed.role, action: "created", entity: "Payment",
      entityId: payment._id.toString(), entityLabel: payment.studentName,
      detail: `${paymentId} · ${paymentType} · ${status} · AED ${amount}${postingError ? ` · LEDGER POSTING FAILED: ${postingError}` : ""}`,
    });

    return NextResponse.json(
      {
        payment: serializePayment(payment),
        ...(postingError ? { warning: `Payment saved, but the accounting entry failed: ${postingError}` } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Failed to record payment.", "payments");
  }
}
