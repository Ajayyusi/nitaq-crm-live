import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Payment } from "@/models/Financial";
import { paymentMethods, paymentTypes, txStatuses } from "@/models/Financial";
import JournalEntry from "@/models/accounting/JournalEntry";
import { serializePayment } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { parseAmount } from "@/lib/money";
import { apiError } from "@/lib/api-error";
import { parseOptionalDate, sameDay, toMongoUpdate } from "@/lib/mongo-update";
import { PAYMENT_SOURCE_TYPES, planForPayment, syncSourceEntry } from "@/lib/accounting/postings";
import { applyPaymentToEnrollment } from "@/lib/enrollment-balance";

type RouteContext = { params: Promise<{ id: string }> };

const allowedMethods = new Set<string>(paymentMethods);
const allowedTypes = new Set<string>(paymentTypes);
const allowedStatuses = new Set<string>(txStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const payment = await Payment.findById(id).lean();
  if (!payment) return NextResponse.json({ message: "Payment not found." }, { status: 404 });
  return NextResponse.json({ payment: serializePayment(payment) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();

    const existing = await Payment.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Payment not found." }, { status: 404 });

    const update: Record<string, unknown> = {};

    for (const f of ["studentName", "studentPhone", "course", "receiptRef", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("studentName" in update && !update.studentName) throw new Error("Student name is required.");

    if ("amount" in body) update.amount = parseAmount(body.amount);
    if ("paymentMethod" in body) {
      const v = clean(body.paymentMethod);
      if (!allowedMethods.has(v)) throw new Error("Invalid payment method.");
      update.paymentMethod = v;
    }
    if ("paymentType" in body) {
      const v = clean(body.paymentType);
      if (!allowedTypes.has(v)) throw new Error("Invalid payment type.");
      update.paymentType = v;
    }
    if ("status" in body) {
      const v = clean(body.status);
      if (!allowedStatuses.has(v)) throw new Error("Invalid status.");
      update.status = v;
    }
    // The form re-sends datePaid on every save. Only a different calendar day
    // is a change — otherwise a notes edit reversed the receipt.
    if ("datePaid" in body) {
      const d = parseOptionalDate(body.datePaid, "Payment date");
      if (!sameDay(d, existing.datePaid)) update.datePaid = d;
    }
    if ("dueDate" in body) update.dueDate = parseOptionalDate(body.dueDate, "Due date");
    if ("installmentNumber" in body) {
      const n = Number(body.installmentNumber);
      update.installmentNumber = n >= 1 ? n : undefined;
    }
    if ("totalInstallments" in body) {
      const n = Number(body.totalInstallments);
      update.totalInstallments = n >= 1 ? n : undefined;
    }

    const next = { ...existing, ...update };
    if (next.status === "Received" && !next.datePaid) {
      next.datePaid = existing.datePaid ?? new Date();
      update.datePaid = next.datePaid;
    }

    // Books must follow the CRM when a money fact changes. A Received payment
    // with no live entry (e.g. one broken by the old edit bug) is re-posted
    // too, so editing a payment repairs it.
    const moneyChanged =
      next.amount !== existing.amount ||
      next.paymentMethod !== existing.paymentMethod ||
      next.paymentType !== existing.paymentType ||
      next.status !== existing.status ||
      "datePaid" in update;
    const missingEntry =
      !moneyChanged && next.status === "Received" &&
      !(await JournalEntry.exists({ sourceType: { $in: PAYMENT_SOURCE_TYPES }, sourceId: id, status: "Posted" }));
    const affectsLedger = moneyChanged || missingEntry;

    const plan = affectsLedger ? await planForPayment(next, authed.name) : null;
    if (affectsLedger) {
      update.journalEntryId = undefined;
      update.postingError = undefined;
    }

    const sync = await syncSourceEntry({
      sourceTypes: PAYMENT_SOURCE_TYPES,
      sourceId: id,
      plan,
      affectsLedger,
      actor: authed.name,
      reason: "Payment edited in CRM",
      applyChange: () => Payment.findByIdAndUpdate(id, toMongoUpdate(update), { new: true, runValidators: true }),
    });
    const payment = sync.result;
    if (!payment) return NextResponse.json({ message: "Payment not found." }, { status: 404 });
    if (sync.entry || sync.postingError) {
      if (sync.entry) payment.journalEntryId = sync.entry._id as never;
      if (sync.postingError) payment.postingError = sync.postingError;
      await payment.save();
    }
    await applyPaymentToEnrollment(existing, payment);

    await logAudit({
      userName: authed.name, userRole: authed.role, action: "updated", entity: "Payment",
      entityId: id, entityLabel: payment.studentName,
      detail: `${payment.paymentId} · AED ${existing.amount} → ${payment.amount} · ${existing.status} → ${payment.status}` +
        `${sync.reversed ? ` · reversal ${sync.reversed.jvNumber}` : ""}` +
        `${sync.postingError ? ` · LEDGER POSTING FAILED: ${sync.postingError}` : ""}`,
    });

    return NextResponse.json({
      payment: serializePayment(payment),
      ...(sync.postingError ? { warning: `Payment saved, but the accounting entry failed: ${sync.postingError}` } : {}),
    });
  } catch (error) {
    return apiError(error, "Failed to update payment.", "payments");
  }
}

// Payment deletion is admin-only by policy.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const existing = await Payment.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Payment not found." }, { status: 404 });

    // Reverse first: if the entry can't be reversed (locked period) the payment
    // stays. It used to be deleted first, leaving a live entry for a payment
    // that no longer existed whenever the reversal failed.
    const sync = await syncSourceEntry({
      sourceTypes: PAYMENT_SOURCE_TYPES,
      sourceId: id,
      plan: null,
      affectsLedger: true,
      actor: authed.name,
      reason: "Payment deleted in CRM",
      order: "reverse-first",
      applyChange: () => Payment.findByIdAndDelete(id),
    });
    await applyPaymentToEnrollment(existing, null);

    await logAudit({
      userName: authed.name, userRole: authed.role, action: "deleted", entity: "Payment",
      entityId: id, entityLabel: existing.studentName,
      detail: `${existing.paymentId} · ${existing.status} · AED ${existing.amount}${sync.reversed ? ` · reversal ${sync.reversed.jvNumber}` : ""}`,
    });
    return NextResponse.json({ message: "Payment deleted." });
  } catch (error) {
    return apiError(error, "Failed to delete payment.", "payments");
  }
}
