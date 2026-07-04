import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount, { accountTypes } from "@/models/accounting/ChartOfAccount";
import { aggregateBalances } from "@/lib/accounting/engine";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const allowedTypes = new Set<string>(accountTypes);

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const search = searchParams.get("search")?.trim();
  const postingOnly = searchParams.get("posting") === "true";

  const query: Record<string, unknown> = {};
  if (type && allowedTypes.has(type)) query.type = type;
  if (postingOnly) { query.isPosting = true; query.isActive = true; }
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ code: rx }, { name: rx }];
  }

  const [accounts, balances] = await Promise.all([
    ChartOfAccount.find(query).sort({ code: 1 }).lean(),
    aggregateBalances(),
  ]);
  const balMap = new Map(balances.map((b) => [b.accountCode, b]));

  // First pass: posting accounts get their own movement
  const rows = accounts.map((a) => {
    const b = balMap.get(a.code);
    const debit = (a.openingDebit ?? 0) + (b?.periodDebit ?? 0);
    const credit = (a.openingCredit ?? 0) + (b?.periodCredit ?? 0);
    return {
      code: a.code, name: a.name, type: a.type,
      category: a.category, subCategory: a.subCategory ?? "", mainAccount: a.mainAccount ?? "",
      parentCode: a.parentCode ?? null,
      isPosting: a.isPosting, isActive: a.isActive, isSystem: a.isSystem,
      openingDebit: a.openingDebit ?? 0, openingCredit: a.openingCredit ?? 0,
      currentDebit: b?.periodDebit ?? 0, currentCredit: b?.periodCredit ?? 0,
      closingBalance: Math.round((debit - credit) * 100) / 100,
    };
  });

  // Second pass: parent accounts roll up totals from descendants (by code prefix on the tree)
  const children = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parentCode) {
      children.set(r.parentCode, [...(children.get(r.parentCode) ?? []), r.code]);
    }
  }
  const byCode = new Map(rows.map((r) => [r.code, r]));
  function rollup(code: string): { d: number; c: number } {
    const row = byCode.get(code);
    if (!row) return { d: 0, c: 0 };
    let d = row.isPosting ? row.openingDebit + row.currentDebit : 0;
    let c = row.isPosting ? row.openingCredit + row.currentCredit : 0;
    for (const ch of children.get(code) ?? []) {
      const r = rollup(ch);
      d += r.d; c += r.c;
    }
    if (!row.isPosting) {
      row.currentDebit = Math.round(d * 100) / 100;
      row.currentCredit = Math.round(c * 100) / 100;
      row.closingBalance = Math.round((d - c) * 100) / 100;
    }
    return { d, c };
  }
  for (const r of rows) if (!r.parentCode) rollup(r.code);

  return NextResponse.json({ accounts: rows });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();
    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    const type = String(body.type ?? "").trim();

    if (!code) return NextResponse.json({ message: "Account code is required." }, { status: 400 });
    if (!name) return NextResponse.json({ message: "Account name is required." }, { status: 400 });
    if (!allowedTypes.has(type)) return NextResponse.json({ message: "Invalid account type." }, { status: 400 });

    const dup = await ChartOfAccount.findOne({ code }).lean();
    if (dup) return NextResponse.json({ message: `Account code ${code} already exists.` }, { status: 409 });

    const parentCode = String(body.parentCode ?? "").trim() || null;
    if (parentCode) {
      const parent = await ChartOfAccount.findOne({ code: parentCode }).lean();
      if (!parent) return NextResponse.json({ message: "Parent account not found." }, { status: 400 });
    }

    const account = await ChartOfAccount.create({
      code, name, type,
      category: String(body.category ?? "").trim(),
      subCategory: String(body.subCategory ?? "").trim() || undefined,
      mainAccount: String(body.mainAccount ?? "").trim() || undefined,
      parentCode,
      isPosting: body.isPosting !== false,
      openingDebit: Number(body.openingDebit) || 0,
      openingCredit: Number(body.openingCredit) || 0,
      isSystem: false,
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "ChartOfAccount",
      entityId: account._id.toString(), entityLabel: `${code} ${name}`,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create account.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
