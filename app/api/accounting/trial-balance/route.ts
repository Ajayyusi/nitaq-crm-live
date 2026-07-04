import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { aggregateBalances } from "@/lib/accounting/engine";
import { requireAuth } from "@/lib/api-auth";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Trial Balance — computed exclusively from posted journal entries plus
 * COA opening balances. Opening column = opening balance + movement BEFORE
 * the from-date; Period columns = movement inside the window.
 */
export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type");

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to + "T23:59:59.999Z") : undefined;

  const [accounts, before, period] = await Promise.all([
    ChartOfAccount.find(type ? { type, isPosting: true } : { isPosting: true }).sort({ code: 1 }).lean(),
    fromDate ? aggregateBalances(undefined, new Date(fromDate.getTime() - 1)) : Promise.resolve([]),
    aggregateBalances(fromDate, toDate),
  ]);
  const beforeMap = new Map(before.map((b) => [b.accountCode, b]));
  const periodMap = new Map(period.map((b) => [b.accountCode, b]));

  let totOpenD = 0, totOpenC = 0, totPerD = 0, totPerC = 0, totCloseD = 0, totCloseC = 0;
  const rows = accounts
    .map((a) => {
      const pre = beforeMap.get(a.code);
      const per = periodMap.get(a.code);
      // opening = COA opening + all movement before window (net presentation)
      const openNet = round2((a.openingDebit ?? 0) - (a.openingCredit ?? 0) + (pre?.periodDebit ?? 0) - (pre?.periodCredit ?? 0));
      const openingDebit = openNet > 0 ? openNet : 0;
      const openingCredit = openNet < 0 ? -openNet : 0;
      const periodDebit = per?.periodDebit ?? 0;
      const periodCredit = per?.periodCredit ?? 0;
      const closeNet = round2(openNet + periodDebit - periodCredit);
      const closingDebit = closeNet > 0 ? closeNet : 0;
      const closingCredit = closeNet < 0 ? -closeNet : 0;
      return {
        code: a.code, name: a.name, type: a.type, category: a.category,
        openingDebit, openingCredit,
        periodDebit: round2(periodDebit), periodCredit: round2(periodCredit),
        closingDebit, closingCredit,
      };
    })
    .filter((r) => r.openingDebit || r.openingCredit || r.periodDebit || r.periodCredit);

  for (const r of rows) {
    totOpenD += r.openingDebit; totOpenC += r.openingCredit;
    totPerD += r.periodDebit; totPerC += r.periodCredit;
    totCloseD += r.closingDebit; totCloseC += r.closingCredit;
  }

  return NextResponse.json({
    rows,
    totals: {
      openingDebit: round2(totOpenD), openingCredit: round2(totOpenC),
      periodDebit: round2(totPerD), periodCredit: round2(totPerC),
      closingDebit: round2(totCloseD), closingCredit: round2(totCloseC),
      balanced: round2(totPerD) === round2(totPerC),
    },
  });
}
