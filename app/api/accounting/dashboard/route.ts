import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import { aggregateBalances } from "@/lib/accounting/engine";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { requireAuth } from "@/lib/api-auth";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const settings = await getAccountingSettings();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [accounts, allTime, thisMonth] = await Promise.all([
    ChartOfAccount.find({ isPosting: true }).select("code type openingDebit openingCredit mainAccount category").lean(),
    aggregateBalances(),
    aggregateBalances(monthStart, now),
  ]);
  const allMap = new Map(allTime.map((b) => [b.accountCode, b]));
  const monthMap = new Map(thisMonth.map((b) => [b.accountCode, b]));

  const net = (code: string) => {
    const a = accounts.find((x) => x.code === code);
    const b = allMap.get(code);
    return round2(
      (a?.openingDebit ?? 0) - (a?.openingCredit ?? 0) + (b?.periodDebit ?? 0) - (b?.periodCredit ?? 0)
    );
  };

  // Cash = all posting accounts under CASH main group; Bank = BANKS group
  let cashBalance = 0, bankBalance = 0, arBalance = 0, apBalance = 0;
  let revenueMonth = 0, expensesMonth = 0, revenueAll = 0, expensesAll = 0;
  for (const a of accounts) {
    const all = allMap.get(a.code);
    const month = monthMap.get(a.code);
    const netAll = round2((a.openingDebit ?? 0) - (a.openingCredit ?? 0) + (all?.periodDebit ?? 0) - (all?.periodCredit ?? 0));
    if (a.mainAccount === "CASH") cashBalance = round2(cashBalance + netAll);
    if (a.mainAccount === "BANKS") bankBalance = round2(bankBalance + netAll);
    if (a.mainAccount === "Accounts Payable") apBalance = round2(apBalance - netAll); // liability: credit positive
    if (a.type === "Revenue") {
      revenueAll = round2(revenueAll - netAll);
      revenueMonth = round2(revenueMonth + (month ? month.periodCredit - month.periodDebit : 0));
    }
    if (a.type === "Expense") {
      expensesAll = round2(expensesAll + netAll);
      expensesMonth = round2(expensesMonth + (month ? month.periodDebit - month.periodCredit : 0));
    }
  }
  arBalance = net(settings.accountsReceivable);
  const outputVat = -net(settings.outputVatAccount); // liability
  const inputVat = net(settings.inputVatAccount);
  const vatPayable = round2(outputVat - inputVat);

  return NextResponse.json({
    cashBalance, bankBalance,
    accountsReceivable: arBalance,
    accountsPayable: apBalance,
    revenueThisMonth: round2(revenueMonth),
    expensesThisMonth: round2(expensesMonth),
    vatPayable,
    netProfit: round2(revenueAll - expensesAll),
    netProfitThisMonth: round2(revenueMonth - expensesMonth),
  });
}
