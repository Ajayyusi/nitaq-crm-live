import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ code: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    const { code } = await context.params;
    await connectDB();
    const account = await ChartOfAccount.findOne({ code });
    if (!account) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    const body = await request.json();
    if ("name" in body) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ message: "Name cannot be empty." }, { status: 400 });
      account.name = name;
    }
    if ("isActive" in body) account.isActive = !!body.isActive;
    if ("openingDebit" in body) account.openingDebit = Math.max(0, Number(body.openingDebit) || 0);
    if ("openingCredit" in body) account.openingCredit = Math.max(0, Number(body.openingCredit) || 0);

    await account.save();
    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "ChartOfAccount",
      entityId: account._id.toString(), entityLabel: `${account.code} ${account.name}`,
    });
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update account.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  const { code } = await context.params;
  await connectDB();
  const account = await ChartOfAccount.findOne({ code });
  if (!account) return NextResponse.json({ message: "Account not found." }, { status: 404 });

  if (account.isSystem) {
    return NextResponse.json({ message: "Seeded accounts cannot be deleted — deactivate instead." }, { status: 400 });
  }
  const used = await JournalEntry.findOne({ "lines.accountCode": code }).lean();
  if (used) {
    return NextResponse.json({ message: "This account has transactions and cannot be deleted — deactivate instead." }, { status: 400 });
  }
  const hasChildren = await ChartOfAccount.findOne({ parentCode: code }).lean();
  if (hasChildren) {
    return NextResponse.json({ message: "This account has child accounts and cannot be deleted." }, { status: 400 });
  }

  await account.deleteOne();
  logAudit({
    userName: authed.name, userRole: authed.role,
    action: "deleted", entity: "ChartOfAccount",
    entityId: code, entityLabel: `${code} ${account.name}`,
  });
  return NextResponse.json({ message: "Account deleted." });
}
