import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { enrollmentStatuses, paymentStatuses, scheduleFormats, teacherPayBases } from "@/models/Enrollment";
import { Payment, paymentMethods } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializeEnrollment } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { postCustomerReceipt, postStudentInvoice, postSafely, reverseEntryForSource } from "@/lib/accounting/postings";

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
  const authed = await requireAuth(["admin", "manager", "sales", "finance", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const enrollment = await Enrollment.findById(id).lean();
  if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });

  // A trainer may only open a registration assigned to them
  if (authed.role === "trainer") {
    const { getTeacherForUser, isTaughtBy } = await import("@/lib/teacher");
    const teacher = await getTeacherForUser(authed);
    if (!teacher || !isTaughtBy(enrollment, teacher._id)) {
      return NextResponse.json({ message: "This student is not assigned to you." }, { status: 403 });
    }
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
    for (const f of ["startDate", "endDate"] as const) {
      if (f in body) update[f] = body[f] ? new Date(body[f]) : undefined;
    }
    for (const f of ["totalFee", "amountPaid"] as const) {
      if (f in body) update[f] = Number(body[f]) || 0;
    }

    // ── Teacher assignment & hour tracking (admin/manager) ──
    if ("expectedCompletionDate" in body) {
      update.expectedCompletionDate = body.expectedCompletionDate ? new Date(body.expectedCompletionDate) : undefined;
    }
    // Trainer pay for this registration — clearing it reverts to the
    // trainer's default rate, which is why "" maps to undefined.
    if ("teacherPayRate" in body) {
      const raw = body.teacherPayRate;
      if (raw === "" || raw == null) {
        update.teacherPayRate = undefined;
      } else {
        const r = Number(raw);
        if (isNaN(r) || r < 0) throw new Error("Trainer pay rate must be zero or more.");
        update.teacherPayRate = Math.round(r * 100) / 100;
      }
    }
    if ("teacherPayBasis" in body) {
      const v = clean(body.teacherPayBasis);
      if (v && !allowedPayBases.has(v)) throw new Error("Invalid trainer pay basis.");
      update.teacherPayBasis = v || undefined;
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
      update.teacherId = ids[0] || undefined;
      update.teacherName = names[0] || undefined;

      const oldIds = new Set(
        (existing.teacherIds?.map((t) => t.toString()) ??
          (existing.teacherId ? [existing.teacherId.toString()] : []))
      );
      const added = ids.filter((tid) => !oldIds.has(tid));
      const removed = [...oldIds].filter((tid) => !ids.includes(tid));

      const { notify } = await import("@/lib/notify");
      for (const tid of added) {
        const t = byId.get(tid);
        if (t?.email) {
          notify({
            userEmail: t.email,
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
          notify({
            userEmail: t.email,
            title: `Student reassigned: ${existing.fullName}`,
            body: `${existing.course} is no longer assigned to you.`,
          });
        }
      }
    }

    const enrollment = await Enrollment.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });

    const newAmountPaid: number = enrollment.amountPaid ?? 0;
    const delta = newAmountPaid - oldAmountPaid;
    if (delta > 0) {
      const currentStatus = (update.paymentStatus as string | undefined) ?? enrollment.paymentStatus;
      const paymentType = derivePaymentType(currentStatus, oldAmountPaid === 0);
      const rawMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
      const paymentMethod = allowedPaymentMethods.has(rawMethod) ? rawMethod : "Cash";
      const seq = await getNextSequence("payment");
      const paymentId = `P-${String(seq).padStart(3, "0")}`;
      const payment = await Payment.create({
        paymentId,
        enrollmentId: enrollment._id,
        studentName: enrollment.fullName,
        studentPhone: enrollment.phone || undefined,
        course: enrollment.course || undefined,
        amount: delta,
        paymentType,
        paymentMethod,
        status: "Received",
        datePaid: new Date(),
        notes: `Auto-recorded from enrollment ${enrollment.enrollmentId}`,
      });
      // Accounting: receipt entry — Dr Cash/Bank, Cr A/R
      const jEntry = await postSafely(() => postCustomerReceipt({
        sourceId: payment._id.toString(),
        sourceNumber: paymentId,
        date: new Date(),
        studentName: enrollment.fullName,
        course: enrollment.course,
        amount: delta,
        paymentMethod,
        createdBy: authed.name,
        enrollmentId: id,
      }));
      if (jEntry) {
        payment.journalEntryId = jEntry._id as never;
        await payment.save();
      }
    }

    // If the fee changed, reverse the old invoice entry and post a new one
    const newTotalFee = enrollment.totalFee ?? 0;
    if ("totalFee" in update && (existing.totalFee ?? 0) !== newTotalFee) {
      await postSafely(() => reverseEntryForSource("Invoice", id, authed.name, "Enrollment fee changed"));
      if (newTotalFee > 0) {
        await postSafely(() => postStudentInvoice({
          sourceId: id,
          sourceNumber: enrollment.enrollmentId ?? id,
          date: enrollment.registrationDate ?? new Date(),
          studentName: enrollment.fullName,
          course: enrollment.course ?? "",
          totalFee: newTotalFee,
          createdBy: authed.name,
        }));
      }
    }

    const changes: string[] = [];
    if ("status" in update && existing.status !== update.status) changes.push(`Status: ${existing.status} → ${String(update.status)}`);
    if ("paymentStatus" in update) changes.push(`Payment: ${String(update.paymentStatus)}`);
    if (delta > 0) changes.push(`Payment recorded: AED ${delta}`);
    if (changes.length === 0) changes.push("Details updated");
    logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "Enrollment", entityId: id, entityLabel: enrollment.fullName, detail: changes.join(" · ") });

    return NextResponse.json({ enrollment: serializeEnrollment(enrollment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update enrollment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const enrollment = await Enrollment.findByIdAndDelete(id);
  if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
  // Keep the books in sync: reverse this enrollment's invoice entry
  await postSafely(() => reverseEntryForSource("Invoice", id, authed.name, "Enrollment deleted in CRM"));
  logAudit({ userName: authed.name, userRole: authed.role, action: "deleted", entity: "Enrollment", entityId: id, entityLabel: enrollment.fullName, detail: enrollment.enrollmentId });
  return NextResponse.json({ message: "Enrollment deleted." });
}
