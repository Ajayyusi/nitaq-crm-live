import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { enrollmentStatuses, paymentStatuses, scheduleFormats, teacherPayBases } from "@/models/Enrollment";
import { Payment, paymentMethods } from "@/models/Financial";
import ClassSession from "@/models/ClassSession";
import { getNextSequence } from "@/models/Counter";
import { serializeEnrollment, serializeEnrollmentForTrainer } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { parseAmount, round2 } from "@/lib/money";
import { apiError, HttpError } from "@/lib/api-error";
import { parseOptionalDate, toMongoUpdate } from "@/lib/mongo-update";
import { preflightJournalEntry } from "@/lib/accounting/engine";
import {
  planCustomerReceipt, planStudentInvoice, postForNewDocument, syncSourceEntry,
} from "@/lib/accounting/postings";
import { payRateChangeBlockedReason } from "@/lib/payroll";

const allowedPaymentMethods = new Set<string>(paymentMethods);

function derivePaymentType(paymentStatus: string, isFirstPayment: boolean): string {
  if (paymentStatus === "Instalment 1 Paid" || paymentStatus === "Instalment 2 Pending") {
    return "Instalment 1 of 2";
  }
  if (paymentStatus === "Paid Full" && !isFirstPayment) {
    return "Instalment 2 of 2";
  }
  return "Full Payment";
}

type RouteContext = { params: Promise<{ id: string }> };

const allowedStatuses = new Set<string>(enrollmentStatuses);
const allowedPaymentStatuses = new Set<string>(paymentStatuses);
const allowedFormats = new Set<string>(scheduleFormats);
const allowedPayBases = new Set<string>(teacherPayBases);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  // No sales: no sales screen opens a registration, and this returned the
  // student's Emirates ID, fees and balance to any sales login.
  const authed = await requireAuth(["admin", "manager", "finance", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const enrollment = await Enrollment.findById(id).lean();
  if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });

  // A trainer may only open a registration assigned to them — and sees it
  // without the student's ID documents or the academy's money facts.
  if (authed.role === "trainer") {
    const { getTeacherForUser, isTaughtBy } = await import("@/lib/teacher");
    const teacher = await getTeacherForUser(authed);
    if (!teacher || !isTaughtBy(enrollment, teacher._id)) {
      return NextResponse.json({ message: "This student is not assigned to you." }, { status: 403 });
    }
    return NextResponse.json({ enrollment: serializeEnrollmentForTrainer(enrollment) });
  }

  return NextResponse.json({ enrollment: serializeEnrollment(enrollment) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();

    const existing = await Enrollment.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
    const oldAmountPaid: number = existing.amountPaid ?? 0;

    const update: Record<string, unknown> = {};

    for (const f of ["fullName", "phone", "email", "emiratesId", "nationality", "course", "batchName", "schedule", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("fullName" in update && !update.fullName) throw new Error("Full name is required.");
    if ("phone" in update && !update.phone) throw new Error("Phone is required.");
    if ("course" in update && !update.course) throw new Error("Course is required.");

    if ("status" in body) {
      const v = clean(body.status);
      if (!allowedStatuses.has(v)) throw new Error("Invalid status.");
      update.status = v;
    }
    if ("paymentStatus" in body) {
      const v = clean(body.paymentStatus);
      if (!allowedPaymentStatuses.has(v)) throw new Error("Invalid payment status.");
      update.paymentStatus = v;
    }
    if ("format" in body) {
      const v = clean(body.format);
      if (!allowedFormats.has(v)) throw new Error("Invalid format.");
      update.format = v;
    }
    if ("startDate" in body) update.startDate = parseOptionalDate(body.startDate, "Start date");
    if ("endDate" in body) update.endDate = parseOptionalDate(body.endDate, "End date");
    if ("totalFee" in body) update.totalFee = parseAmount(body.totalFee, { field: "Total fee", allowZero: true });
    if ("amountPaid" in body) {
      const paid = parseAmount(body.amountPaid, { field: "Amount paid", allowZero: true });
      // Lowering amountPaid used to post nothing — and raising it again then
      // recorded a SECOND payment and receipt for money received once. It is
      // also lower whenever a payment was recorded elsewhere after this form
      // was opened, so this is the same "reload" situation.
      if (paid < oldAmountPaid) {
        throw new HttpError(
          `Amount paid is AED ${oldAmountPaid} on file. Reload the registration — a payment may have been ` +
          "recorded since you opened it. To reduce what was paid, record a refund on the Payments page.",
          409
        );
      }
      update.amountPaid = paid;
    }

    // ── Teacher assignment & hour tracking (admin/manager) ──
    if ("expectedCompletionDate" in body) {
      update.expectedCompletionDate = parseOptionalDate(body.expectedCompletionDate, "Expected completion date");
    }
    // Trainer pay for this registration — clearing it reverts to the
    // trainer's default rate, which is why "" maps to undefined ($unset).
    if ("teacherPayRate" in body) {
      const raw = body.teacherPayRate;
      update.teacherPayRate = raw === "" || raw == null
        ? undefined
        : parseAmount(raw, { field: "Trainer pay rate", allowZero: true });
    }
    if ("teacherPayBasis" in body) {
      const v = clean(body.teacherPayBasis);
      if (v && !allowedPayBases.has(v)) throw new Error("Invalid trainer pay basis.");
      update.teacherPayBasis = v || undefined;
    }
    if ("teacherPayRate" in update || "teacherPayBasis" in update) {
      const nextPay = {
        teacherPayRate: ("teacherPayRate" in update ? update.teacherPayRate : existing.teacherPayRate) as number | undefined,
        teacherPayBasis: ("teacherPayBasis" in update ? update.teacherPayBasis : existing.teacherPayBasis) as string | undefined,
      };
      // A rate with no basis silently meant "Per Hour", even for a Per Class trainer.
      if ((nextPay.teacherPayRate ?? 0) > 0 && !nextPay.teacherPayBasis) {
        throw new Error("Choose a pay basis for this trainer rate.");
      }
      const blocked = await payRateChangeBlockedReason(id, existing, nextPay);
      if (blocked) throw new HttpError(blocked, 409);
    }
    if ("totalRegisteredHours" in body) {
      const h = Number(body.totalRegisteredHours);
      if (body.totalRegisteredHours !== "" && (isNaN(h) || h < 0)) throw new Error("Registered hours must be zero or more.");
      update.totalRegisteredHours = body.totalRegisteredHours === "" ? undefined : Math.round(h * 100) / 100;
    }
    // Completing a registration with hours remaining requires an explicit admin override
    {
      const finalStatus = (update.status as string | undefined) ?? existing.status;
      const finalTotal = ("totalRegisteredHours" in update ? (update.totalRegisteredHours as number) : existing.totalRegisteredHours) ?? 0;
      const done = existing.completedHours ?? 0;
      if (finalStatus === "Completed" && existing.status !== "Completed" && finalTotal > done && body.overrideCompletion !== true) {
        throw new Error(`Cannot mark Completed: ${Math.round((finalTotal - done) * 100) / 100}h still remain. Use the admin override (with reason) to force completion.`);
      }
    }
    // Trainer assignment — a registration may have several trainers.
    // Accepts teacherIds (preferred) or a single teacherId from older clients.
    const notifications: { email: string; title: string; body: string; link?: string }[] = [];
    if ("teacherIds" in body || "teacherId" in body) {
      const raw: string[] = Array.isArray(body.teacherIds)
        ? body.teacherIds.map(String)
        : "teacherId" in body && body.teacherId
          ? [String(body.teacherId)]
          : [];
      for (const tid of raw) {
        if (!mongoose.Types.ObjectId.isValid(tid)) throw new Error("Invalid trainer.");
      }
      const ids = [...new Set(raw)];
      const { default: Teacher } = await import("@/models/Teacher");
      const teachers = ids.length
        ? await Teacher.find({ _id: { $in: ids } }).select("fullName email").lean()
        : [];
      if (teachers.length !== ids.length) throw new Error("Trainer not found.");

      const byId = new Map(teachers.map((t) => [t._id.toString(), t]));
      // Preserve the caller's ordering: the first entry is the primary trainer
      const names = ids.map((tid) => byId.get(tid)?.fullName ?? "");
      update.teacherIds = ids;
      update.teacherNames = names;
      // Emptying the list must really clear the primary trainer ($unset) — it
      // used to stay behind and keep the old trainer's access to the student.
      update.teacherId = ids[0] || undefined;
      update.teacherName = names[0] || undefined;

      const oldIds = new Set(
        (existing.teacherIds?.map((t) => t.toString()) ??
          (existing.teacherId ? [existing.teacherId.toString()] : []))
      );
      const added = ids.filter((tid) => !oldIds.has(tid));
      const removed = [...oldIds].filter((tid) => !ids.includes(tid));
      for (const tid of added) {
        const t = byId.get(tid);
        if (t?.email) {
          notifications.push({
            email: t.email,
            title: `New student assigned: ${existing.fullName}`,
            body: `${existing.course} — assigned to you by ${authed.name}.`,
            link: "/my-students",
          });
        }
      }
      if (removed.length) {
        const gone = await Teacher.find({ _id: { $in: removed } }).select("email").lean();
        for (const t of gone) {
          if (!t.email) continue;
          notifications.push({
            email: t.email,
            title: `Student reassigned: ${existing.fullName}`,
            body: `${existing.course} is no longer assigned to you.`,
          });
        }
      }
    }

    const next = { ...existing, ...update };

    // ── A payment recorded through this form: prepared and validated first ──
    const delta = round2(((update.amountPaid as number | undefined) ?? oldAmountPaid) - oldAmountPaid);
    let receipt: { payment: InstanceType<typeof Payment>; plan: Awaited<ReturnType<typeof planCustomerReceipt>> } | null = null;
    if (delta > 0) {
      const currentStatus = (update.paymentStatus as string | undefined) ?? existing.paymentStatus;
      const paymentType = derivePaymentType(currentStatus, oldAmountPaid === 0);
      const rawMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
      const paymentMethod = allowedPaymentMethods.has(rawMethod) ? rawMethod : "Cash";
      const seq = await getNextSequence("payment");
      const paymentId = `P-${String(seq).padStart(3, "0")}`;
      const payment = new Payment({
        paymentId,
        enrollmentId: existing._id,
        studentName: next.fullName,
        studentPhone: next.phone || undefined,
        course: next.course || undefined,
        amount: delta,
        paymentType,
        paymentMethod,
        status: "Received",
        datePaid: new Date(),
        recordedBy: authed.name,
        notes: `Auto-recorded from enrollment ${existing.enrollmentId}`,
      });
      const plan = await planCustomerReceipt({
        sourceId: payment._id.toString(),
        sourceNumber: paymentId,
        date: payment.datePaid!,
        studentName: next.fullName,
        course: next.course,
        amount: delta,
        paymentMethod,
        createdBy: authed.name,
        enrollmentId: id,
      });
      if (plan) await preflightJournalEntry(plan);
      receipt = { payment, plan };
    }

    // ── Fee change: reverse the old invoice and post the new one ──
    const feeChanged = "totalFee" in update && (existing.totalFee ?? 0) !== update.totalFee;
    const invoicePlan = feeChanged
      ? await planStudentInvoice({
          sourceId: id,
          sourceNumber: existing.enrollmentId ?? id,
          date: existing.registrationDate ?? new Date(),
          studentName: next.fullName,
          course: next.course ?? "",
          totalFee: update.totalFee as number,
          createdBy: authed.name,
        })
      : null;
    if (feeChanged) update.postingError = undefined;

    // The update only applies if amountPaid is still what this request read,
    // so a double-click can't record the same payment twice.
    const filter: Record<string, unknown> = { _id: id };
    if ("amountPaid" in update) filter.amountPaid = existing.amountPaid ?? null;

    const sync = await syncSourceEntry({
      sourceTypes: ["Invoice"],
      sourceId: id,
      plan: invoicePlan,
      affectsLedger: feeChanged,
      actor: authed.name,
      reason: "Enrollment fee changed",
      applyChange: async () => {
        const doc = await Enrollment.findOneAndUpdate(filter, toMongoUpdate(update), { new: true, runValidators: true });
        if (!doc) throw new HttpError("This registration was changed by someone else — reload and try again.", 409);
        return doc;
      },
    });
    const enrollment = sync.result;
    const warnings: string[] = [];
    if (sync.postingError) {
      enrollment.postingError = sync.postingError;
      await enrollment.save();
      warnings.push(`the invoice entry failed: ${sync.postingError}`);
    }

    if (receipt) {
      await receipt.payment.save();
      const { entry, postingError } = await postForNewDocument(receipt.plan);
      if (entry || postingError) {
        if (entry) receipt.payment.journalEntryId = entry._id as never;
        if (postingError) {
          receipt.payment.postingError = postingError;
          warnings.push(`the receipt entry failed: ${postingError}`);
        }
        await receipt.payment.save();
      }
    }

    const { notify } = await import("@/lib/notify");
    for (const n of notifications) notify({ userEmail: n.email, title: n.title, body: n.body, link: n.link });

    const changes: string[] = [];
    if ("status" in update && existing.status !== update.status) changes.push(`Status: ${existing.status} → ${String(update.status)}`);
    if ("paymentStatus" in update) changes.push(`Payment: ${String(update.paymentStatus)}`);
    if (feeChanged) changes.push(`Fee: AED ${existing.totalFee ?? 0} → ${String(update.totalFee)}`);
    if (delta > 0) changes.push(`Payment recorded: AED ${delta} (${receipt?.payment.paymentId})`);
    if ("teacherPayRate" in update || "teacherPayBasis" in update) {
      changes.push(`Trainer pay: ${existing.teacherPayRate ?? "default"} ${existing.teacherPayBasis ?? ""} → ${String(next.teacherPayRate ?? "default")} ${next.teacherPayBasis ?? ""}`.trim());
    }
    if (warnings.length) changes.push(`LEDGER POSTING FAILED: ${warnings.join("; ")}`);
    if (changes.length === 0) changes.push("Details updated");
    await logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "Enrollment", entityId: id, entityLabel: enrollment.fullName, detail: changes.join(" · ") });

    return NextResponse.json({
      enrollment: serializeEnrollment(enrollment),
      ...(warnings.length ? { warning: `Saved, but ${warnings.join("; ")}` } : {}),
    });
  } catch (error) {
    return apiError(error, "Failed to update enrollment.", "enrollments");
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const existing = await Enrollment.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });

    // Deleting a registration that has money or teaching history used to
    // reverse only its invoice: its receipts stayed in the ledger (leaving the
    // student's account in credit), its payments and class records pointed at
    // nothing, and payroll kept paying those sessions at the default rate.
    const [payments, sessions] = await Promise.all([
      Payment.countDocuments({ enrollmentId: id }),
      ClassSession.countDocuments({ enrollmentId: id }),
    ]);
    if (payments || sessions) {
      const parts = [
        payments ? `${payments} payment${payments === 1 ? "" : "s"}` : "",
        sessions ? `${sessions} class record${sessions === 1 ? "" : "s"}` : "",
      ].filter(Boolean).join(" and ");
      return NextResponse.json(
        { message: `This registration has ${parts}, so it can't be deleted — change its status (e.g. Dropped) instead.` },
        { status: 409 }
      );
    }

    // Reverse first: a locked-period invoice keeps the registration.
    const sync = await syncSourceEntry({
      sourceTypes: ["Invoice"],
      sourceId: id,
      plan: null,
      affectsLedger: true,
      actor: authed.name,
      reason: "Enrollment deleted in CRM",
      order: "reverse-first",
      applyChange: () => Enrollment.findByIdAndDelete(id),
    });
    await logAudit({
      userName: authed.name, userRole: authed.role, action: "deleted", entity: "Enrollment",
      entityId: id, entityLabel: existing.fullName,
      detail: `${existing.enrollmentId} · fee AED ${existing.totalFee ?? 0}${sync.reversed ? ` · reversal ${sync.reversed.jvNumber}` : ""}`,
    });
    return NextResponse.json({ message: "Enrollment deleted." });
  } catch (error) {
    return apiError(error, "Failed to delete enrollment.", "enrollments");
  }
}
