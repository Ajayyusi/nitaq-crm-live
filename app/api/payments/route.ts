import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Payment } from "@/models/Financial";
import { paymentMethods, paymentTypes, txStatuses } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializePayment } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

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
    const message = error instanceof Error ? error.message : "Failed to load payments.";
    return NextResponse.json({ message }, { status: 500 });
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
    if (!body.amount || Number(body.amount) <= 0) throw new Error("Amount must be greater than 0.");

    const paymentMethod = clean(body.paymentMethod) || "Cash";
    const paymentType = clean(body.paymentType) || "Full Payment";
    const status = clean(body.status) || "Received";

    if (!allowedMethods.has(paymentMethod)) throw new Error("Invalid payment method.");
    if (!allowedTypes.has(paymentType)) throw new Error("Invalid payment type.");
    if (!allowedStatuses.has(status)) throw new Error("Invalid status.");

    const seq = await getNextSequence("payment");
    const paymentId = `P-${String(seq).padStart(3, "0")}`;

    const payment = await Payment.create({
      paymentId,
      studentName,
      studentPhone: clean(body.studentPhone) || undefined,
      course: clean(body.course) || undefined,
      amount: Number(body.amount),
      paymentType,
      paymentMethod,
      status,
      datePaid: body.datePaid ? new Date(body.datePaid) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      receiptRef: clean(body.receiptRef) || undefined,
      notes: clean(body.notes) || undefined,
      recordedBy: clean(body.recordedBy) || undefined,
      enrollmentId: body.enrollmentId || undefined,
    });

    return NextResponse.json({ payment: serializePayment(payment) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
