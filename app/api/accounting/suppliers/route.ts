import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Supplier from "@/models/accounting/Supplier";
import SupplierBill from "@/models/accounting/SupplierBill";
import SupplierPayment from "@/models/accounting/SupplierPayment";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { getNextSequence } from "@/models/Counter";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const [suppliers, billAgg, payAgg] = await Promise.all([
    Supplier.find({}).sort({ supplierCode: 1 }).lean(),
    SupplierBill.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: "$supplierId", billed: { $sum: "$totalAmount" } } },
    ]),
    SupplierPayment.aggregate([
      { $group: { _id: "$supplierId", paid: { $sum: "$amount" } } },
    ]),
  ]);
  const billMap = new Map(billAgg.map((b) => [b._id.toString(), b.billed]));
  const payMap = new Map(payAgg.map((p) => [p._id.toString(), p.paid]));

  return NextResponse.json({
    suppliers: suppliers.map((s) => {
      const billed = billMap.get(s._id.toString()) ?? 0;
      const paid = payMap.get(s._id.toString()) ?? 0;
      return {
        id: s._id.toString(),
        supplierCode: s.supplierCode,
        name: s.name,
        contactPerson: s.contactPerson ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        trn: s.trn ?? "",
        address: s.address ?? "",
        vatRegistered: s.vatRegistered,
        defaultExpenseAccountCode: s.defaultExpenseAccountCode ?? "",
        openingBalance: s.openingBalance ?? 0,
        totalBilled: billed,
        totalPaid: paid,
        balance: Math.round(((s.openingBalance ?? 0) + billed - paid) * 100) / 100,
        isActive: s.isActive,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ message: "Supplier name is required." }, { status: 400 });

    let supplierCode = String(body.supplierCode ?? "").trim().toUpperCase();
    if (!supplierCode) {
      const seq = await getNextSequence("supplier");
      supplierCode = `SP${String(seq + 3).padStart(3, "0")}`; // SP001-003 are seeded
    }
    const dup = await Supplier.findOne({ supplierCode }).lean();
    if (dup) return NextResponse.json({ message: `Supplier code ${supplierCode} already exists.` }, { status: 409 });

    const supplier = await Supplier.create({
      supplierCode,
      name,
      contactPerson: String(body.contactPerson ?? "").trim() || undefined,
      phone: String(body.phone ?? "").trim() || undefined,
      email: String(body.email ?? "").trim().toLowerCase() || undefined,
      trn: String(body.trn ?? "").trim() || undefined,
      address: String(body.address ?? "").trim() || undefined,
      vatRegistered: !!body.vatRegistered,
      defaultExpenseAccountCode: String(body.defaultExpenseAccountCode ?? "").trim() || undefined,
      openingBalance: Number(body.openingBalance) || 0,
    });

    // Auto-create the supplier's ledger account under Accounts Payable
    const settings = await getAccountingSettings();
    const existsInCoa = await ChartOfAccount.findOne({ code: supplierCode }).lean();
    if (!existsInCoa) {
      await ChartOfAccount.create({
        code: supplierCode,
        name,
        type: "Liability",
        category: "LIABILITIES",
        mainAccount: "Accounts Payable",
        parentCode: settings.accountsPayable,
        isPosting: true,
        openingCredit: Math.max(0, Number(body.openingBalance) || 0),
        isSystem: false,
      });
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "Supplier",
      entityId: supplier._id.toString(), entityLabel: `${supplierCode} ${name}`,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create supplier.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
