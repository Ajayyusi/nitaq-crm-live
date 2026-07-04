import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Supplier from "@/models/accounting/Supplier";
import SupplierBill from "@/models/accounting/SupplierBill";
import { getNextSequence } from "@/models/Counter";
import { postSupplierBill, postSafely } from "@/lib/accounting/postings";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  const bills = await SupplierBill.find(query).sort({ billDate: -1 }).limit(300).lean();
  return NextResponse.json({
    bills: bills.map((b) => ({
      id: b._id.toString(), billNumber: b.billNumber,
      supplierId: b.supplierId.toString(), supplierName: b.supplierName,
      billDate: b.billDate.toISOString().slice(0, 10),
      dueDate: b.dueDate?.toISOString().slice(0, 10) ?? "",
      reference: b.reference ?? "", description: b.description ?? "",
      expenseAccountCode: b.expenseAccountCode,
      amountBeforeVAT: b.amountBeforeVAT, vatRate: b.vatRate, vatAmount: b.vatAmount,
      totalAmount: b.totalAmount, amountPaid: b.amountPaid ?? 0, status: b.status,
      journalEntryId: b.journalEntryId?.toString() ?? "",
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

    const amountBeforeVAT = Math.round((Number(body.amountBeforeVAT) || 0) * 100) / 100;
    if (amountBeforeVAT <= 0) return NextResponse.json({ message: "Amount must be greater than 0." }, { status: 400 });
    const vatRate = Number(body.vatRate) || 0;
    if (vatRate < 0) return NextResponse.json({ message: "VAT rate cannot be negative." }, { status: 400 });
    const vatAmount = Math.round(amountBeforeVAT * vatRate) / 100;
    const totalAmount = Math.round((amountBeforeVAT + vatAmount) * 100) / 100;

    const expenseAccountCode = String(body.expenseAccountCode ?? "").trim() || supplier.defaultExpenseAccountCode;
    if (!expenseAccountCode) return NextResponse.json({ message: "Expense account is required." }, { status: 400 });

    const seq = await getNextSequence("supplier-bill");
    const billNumber = `SB-${String(seq).padStart(4, "0")}`;

    const bill = await SupplierBill.create({
      billNumber,
      supplierId: supplier._id,
      supplierName: supplier.name,
      billDate: body.billDate ? new Date(body.billDate) : new Date(),
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      reference: String(body.reference ?? "").trim() || undefined,
      expenseAccountCode,
      description: String(body.description ?? "").trim() || undefined,
      amountBeforeVAT, vatRate, vatAmount, totalAmount,
      createdBy: authed.name,
    });

    // Auto double-entry: Dr Expense (+ Dr Input VAT) / Cr Supplier A/P
    const entry = await postSafely(() => postSupplierBill({
      sourceId: bill._id.toString(),
      sourceNumber: billNumber,
      date: bill.billDate,
      supplierAccountCode: supplier.supplierCode,
      supplierName: supplier.name,
      expenseAccountCode,
      amountBeforeVAT, vatAmount,
      description: bill.description,
      createdBy: authed.name,
    }));
    if (entry) {
      bill.journalEntryId = entry._id as never;
      await bill.save();
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "SupplierBill",
      entityId: bill._id.toString(), entityLabel: `${billNumber} · ${supplier.name}`,
      detail: `AED ${totalAmount}`,
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bill.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
