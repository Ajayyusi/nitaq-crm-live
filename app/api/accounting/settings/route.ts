import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AccountingSettings, { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const ACCOUNT_FIELDS = [
  "defaultCashAccount", "defaultBankAccount", "defaultPosAccount",
  "tabbyAccount", "tamaraAccount", "pettyCashAccount",
  "accountsReceivable", "accountsPayable", "feesAdvanceAccount",
  "outputVatAccount", "inputVatAccount",
  "defaultRevenueAccount", "defaultExpenseAccount", "teacherSalaryAccount",
  "discountAccount", "refundAccount", "badDebtAccount",
] as const;

function serialize(input: unknown) {
  const s = input as { toObject?: () => Record<string, unknown> } & Record<string, unknown>;
  const obj = typeof s.toObject === "function" ? s.toObject() : s;
  const map = obj.courseRevenueMap;
  return {
    ...Object.fromEntries(ACCOUNT_FIELDS.map((f) => [f, (obj as Record<string, unknown>)[f] ?? ""])),
    courseRevenueMap: map instanceof Map ? Object.fromEntries(map) : (map ?? {}),
    vatEnabled: !!obj.vatEnabled,
    vatRate: Number(obj.vatRate) || 5,
    autoPostPayments: obj.autoPostPayments !== false,
    autoPostExpenses: obj.autoPostExpenses !== false,
    autoPostInvoices: obj.autoPostInvoices !== false,
    lockDate: obj.lockDate ? new Date(obj.lockDate as string).toISOString().slice(0, 10) : "",
  };
}

export async function GET() {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;
  await connectDB();
  const settings = await getAccountingSettings();
  return NextResponse.json({ settings: serialize(settings) });
}

export async function PATCH(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();
    const settings = await getAccountingSettings();

    // Validate any account code being set actually exists
    for (const f of ACCOUNT_FIELDS) {
      if (f in body) {
        const code = String(body[f] ?? "").trim();
        if (code) {
          const acc = await ChartOfAccount.findOne({ code }).lean();
          if (!acc) return NextResponse.json({ message: `Account ${code} not found (${f}).` }, { status: 400 });
        }
        (settings as never as Record<string, unknown>)[f] = code;
      }
    }
    if ("vatEnabled" in body) settings.vatEnabled = !!body.vatEnabled;
    if ("vatRate" in body) settings.vatRate = Math.max(0, Number(body.vatRate) || 0);
    if ("autoPostPayments" in body) settings.autoPostPayments = !!body.autoPostPayments;
    if ("autoPostExpenses" in body) settings.autoPostExpenses = !!body.autoPostExpenses;
    if ("autoPostInvoices" in body) settings.autoPostInvoices = !!body.autoPostInvoices;
    if ("courseRevenueMap" in body && body.courseRevenueMap && typeof body.courseRevenueMap === "object") {
      settings.courseRevenueMap = body.courseRevenueMap;
    }
    if ("lockDate" in body) {
      settings.lockDate = body.lockDate ? new Date(body.lockDate) : null;
    }

    await settings.save();
    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "AccountingSettings",
      entityId: "singleton", entityLabel: "Accounting Settings",
    });
    return NextResponse.json({ settings: serialize(settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
