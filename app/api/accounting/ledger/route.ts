import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getLedger } from "@/lib/accounting/engine";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const accountCode = searchParams.get("account")?.trim();
  if (!accountCode) return NextResponse.json({ message: "account parameter is required." }, { status: 400 });

  const account = await ChartOfAccount.findOne({ code: accountCode }).lean();
  if (!account) return NextResponse.json({ message: "Account not found." }, { status: 404 });

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sourceType = searchParams.get("sourceType") ?? undefined;

  const rows = await getLedger({
    accountCode,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to + "T23:59:59.999Z") : undefined,
    sourceType: sourceType || undefined,
  });

  return NextResponse.json({
    account: { code: account.code, name: account.name, type: account.type },
    rows,
  });
}
