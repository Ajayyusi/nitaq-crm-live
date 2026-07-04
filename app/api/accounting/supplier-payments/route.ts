import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Supplier from "@/models/accounting/Supplier";
import SupplierBill from "@/models/accounting/SupplierBill";
import SupplierPayment from "@/models/accounting/SupplierPayment";
import { getNextSequence } from "@/models/Counter";
import { postSupplierPayment, postSafely } from "@/lib/accounting/postings";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const payments = await SupplierPayment.find({}).sort({ paymentDate: -1 }).limit(300).lean();
  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p._id.toString(), paymentNumber: p.paymentNumber,
      supplierId: p.supplierId.toString(), supplierName: p.supplierName,
      billId: p.billId?.toString() ?? "",
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      amount: p.amount, paymentAccountCode: p.paymentAccountCode,
      reference: p.reference ?? "", notes: p.notes ?? "",
      journalEntryId: p.journalEntryId?.toString() ?? "",
    })),
  });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(body.supplierId))
      return NextResponse.json({ message: "Valid supplier is required." }, { status: 400 });
    const supplier = await Supplier.findById(body.supplierId).lean();
    if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });

    const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
    if (amount <= 0) return NextResponse.json({ message: "Amount must be greater than 0." }, { status: 400 });

    const paymentAccountCode = String(body.paymentAccountCode ?? "").trim();
    if (!paymentAccountCode) return NextResponse.json({ message: "Payment account is required." }, { status: 400 });

    const seq = await getNextSequence("supplier-payment");
    const paymentNumber = `SPY-${String(seq).padStart(4, "0")}`;

    const payment = await SupplierPayment.create({
      paymentNumber,
      supplierId: supplier._id,
      supplierName: supplier.name,
      billId: mongoose.Types.ObjectId.isValid(body.billId) ? body.billId : undefined,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      amount,
      paymentAccountCode,
      reference: String(body.reference ?? "").trim() || undefined,
      notes: String(body.notes ?? "").trim() || undefined,
      createdBy: authed.name,
    });

    // Update bill paid amount + status
    if (payment.billId) {
      const bill = await SupplierBill.findById(payment.billId);
      if (bill) {
        bill.amountPaid = Math.round(((bill.amountPaid ?? 0) + amount) * 100) / 100;
        bill.status = bill.amountPaid >= bill.totalAmount ? "Paid" : "Partially Paid";
        await bill.save();
      }
    }

    // Auto double-entry: Dr Supplier A/P / Cr Cash-Bank-Petty
    const entry = await postSafely(() => postSupplierPayment({
      sourceId: payment._id.toString(),
      sourceNumber: paymentNumber,
      date: payment.paymentDate,
      supplierAccountCode: supplier.supplierCode,
      supplierName: supplier.name,
      amount,
      paymentAccountCode,
      createdBy: authed.name,
    }));
    if (entry) {
      payment.journalEntryId = entry._id as never;
      await payment.save();
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "SupplierPayment",
      entityId: payment._id.toString(), entityLabel: `${paymentNumber} · ${supplier.name}`,
      detail: `AED ${amount}`,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
