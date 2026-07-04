import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Supplier from "@/models/accounting/Supplier";
import SupplierBill from "@/models/accounting/SupplierBill";
import SupplierPayment from "@/models/accounting/SupplierPayment";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/** Supplier detail + statement (bills and payments merged chronologically). */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  await connectDB();
  const supplier = await Supplier.findById(id).lean();
  if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });

  const [bills, payments] = await Promise.all([
    SupplierBill.find({ supplierId: id }).sort({ billDate: 1 }).lean(),
    SupplierPayment.find({ supplierId: id }).sort({ paymentDate: 1 }).lean(),
  ]);

  // Statement: opening balance, then bills (credit us→balance up) and payments (balance down)
  type Row = { date: string; type: "Bill" | "Payment"; number: string; reference: string; description: string; amount: number; balance: number };
  const events = [
    ...bills.filter((b) => b.status !== "Cancelled").map((b) => ({
      date: b.billDate, type: "Bill" as const, number: b.billNumber,
      reference: b.reference ?? "", description: b.description ?? "", amount: b.totalAmount,
    })),
    ...payments.map((p) => ({
      date: p.paymentDate, type: "Payment" as const, number: p.paymentNumber,
      reference: p.reference ?? "", description: p.notes ?? "", amount: -p.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = supplier.openingBalance ?? 0;
  const statement: Row[] = events.map((e) => {
    balance = Math.round((balance + e.amount) * 100) / 100;
    return {
      date: e.date.toISOString().slice(0, 10),
      type: e.type, number: e.number, reference: e.reference,
      description: e.description, amount: Math.abs(e.amount), balance,
    };
  });

  // Aging on open bills
  const now = Date.now();
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const b of bills) {
    if (b.status === "Paid" || b.status === "Cancelled") continue;
    const open = b.totalAmount - (b.amountPaid ?? 0);
    if (open <= 0) continue;
    const age = (now - (b.dueDate ?? b.billDate).getTime()) / 86400000;
    if (age <= 0) aging.current += open;
    else if (age <= 30) aging.d30 += open;
    else if (age <= 60) aging.d60 += open;
    else aging.d90 += open;
  }

  return NextResponse.json({
    supplier: { ...supplier, id: supplier._id.toString() },
    statement,
    balance,
    aging,
    bills: bills.map((b) => ({
      id: b._id.toString(), billNumber: b.billNumber,
      billDate: b.billDate.toISOString().slice(0, 10),
      dueDate: b.dueDate?.toISOString().slice(0, 10) ?? "",
      reference: b.reference ?? "", description: b.description ?? "",
      expenseAccountCode: b.expenseAccountCode,
      amountBeforeVAT: b.amountBeforeVAT, vatAmount: b.vatAmount,
      totalAmount: b.totalAmount, amountPaid: b.amountPaid ?? 0, status: b.status,
      journalEntryId: b.journalEntryId?.toString() ?? "",
    })),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  try {
    await connectDB();
    const supplier = await Supplier.findById(id);
    if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });

    const body = await request.json();
    for (const f of ["name", "contactPerson", "phone", "trn", "address", "defaultExpenseAccountCode"] as const) {
      if (f in body) (supplier as never as Record<string, unknown>)[f] = String(body[f] ?? "").trim() || undefined;
    }
    if ("email" in body) supplier.email = String(body.email ?? "").trim().toLowerCase() || undefined;
    if ("vatRegistered" in body) supplier.vatRegistered = !!body.vatRegistered;
    if ("isActive" in body) supplier.isActive = !!body.isActive;
    if (!supplier.name) return NextResponse.json({ message: "Name is required." }, { status: 400 });

    await supplier.save();
    // Keep the COA account name in sync
    await ChartOfAccount.updateOne({ code: supplier.supplierCode }, { $set: { name: supplier.name, isActive: supplier.isActive } });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "Supplier",
      entityId: id, entityLabel: `${supplier.supplierCode} ${supplier.name}`,
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update supplier.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
