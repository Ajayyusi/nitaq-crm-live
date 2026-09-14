/**
 * Owner finance metrics — the figures on the Finance page.
 *
 * Every number is derived from POSTED, active journal entries (the same filter
 * the Trial Balance and General Ledger use: status Posted, reversal pairs
 * excluded) plus Chart of Accounts opening balances. Nothing here sums CRM
 * documents, so each card can be traced to journal lines, and the charts use
 * exactly the same classifications as the cards they sit next to.
 *
 * Periods are calendar days in UAE time (Asia/Dubai, UTC+4, no DST): a
 * receipt taken at 00:30 on the 1st belongs to that month, not the previous one.
 */
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";

const TZ = "Asia/Dubai";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const round2 = (n: number) => Math.round(n * 100) / 100;

export type MetricKey =
  | "earnedRevenue"
  | "cashCollected"
  | "netProfit"
  | "availableCash"
  | "customersOweUs"
  | "weOwe"
  | "moneyOut"
  | "vatEstimate";

export type MetricBasis = "Accrual" | "Cash" | "Balance";

/** One definition per card. The page renders these words verbatim. */
export const FINANCE_METRICS: Record<MetricKey, { label: string; basis: MetricBasis; definition: string }> = {
  earnedRevenue: {
    label: "Earned Revenue",
    basis: "Accrual",
    definition:
      "Course revenue recognised in the period, excluding VAT. Under the current policy a fee is recognised when it is invoiced.",
  },
  cashCollected: {
    label: "Cash Collected",
    basis: "Cash",
    definition:
      "Money received from students in the period, including advances, across cash, POS, Tabby, Tamara and bank.",
  },
  netProfit: {
    label: "Net Profit",
    basis: "Accrual",
    definition:
      "Earned revenue minus every recognised expense in the period, including teacher pay and supplier bills.",
  },
  availableCash: {
    label: "Available Cash",
    basis: "Balance",
    definition: "Cash, card/BNPL clearing and bank balances at the end of the period, including opening balances.",
  },
  customersOweUs: {
    label: "Customers Owe Us",
    basis: "Balance",
    definition: "Unpaid balances on student receivable accounts at the end of the period.",
  },
  weOwe: {
    label: "We Owe",
    basis: "Balance",
    definition: "Open supplier bills and other current payables (accrued salaries, cheques payable) at the end of the period.",
  },
  moneyOut: {
    label: "Money Out",
    basis: "Cash",
    definition:
      "Cash and bank paid out in the period: expenses, supplier payments, teacher pay and refunds. Transfers between your own accounts are excluded.",
  },
  vatEstimate: {
    label: "VAT Estimate",
    basis: "Accrual",
    definition: "Output VAT charged minus input VAT recorded in the period. An estimate, not a VAT return.",
  },
};

// ── UAE calendar helpers ─────────────────────────────────────────────────────

/** Today's date (YYYY-MM-DD) on a UAE calendar. */
export function uaeDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** 1st of the current UAE month → today. */
export function uaeThisMonth(now = new Date()): { from: string; to: string } {
  const today = uaeDate(now);
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

const dayStart = (day: string) => new Date(`${day}T00:00:00.000+04:00`);
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999+04:00`);

// ── Account classification ───────────────────────────────────────────────────

interface AccountClasses {
  money: Set<string>;
  clearing: Set<string>;
  receivable: Set<string>;
  payable: Set<string>;
  revenue: Set<string>;
  expense: Set<string>;
  outputVat: string;
  inputVat: string;
  feesAdvance: string;
  cashAccount: string;
  names: Map<string, string>;
  opening: Map<string, number>; // net debit
}

async function classifyAccounts(): Promise<AccountClasses> {
  const [accounts, s] = await Promise.all([
    ChartOfAccount.find({ isPosting: true })
      .select("code name type mainAccount parentCode openingDebit openingCredit")
      .lean(),
    getAccountingSettings(),
  ]);
  const c: AccountClasses = {
    money: new Set(), clearing: new Set(), receivable: new Set(), payable: new Set(),
    revenue: new Set(), expense: new Set(),
    outputVat: s.outputVatAccount, inputVat: s.inputVatAccount, feesAdvance: s.feesAdvanceAccount,
    cashAccount: s.defaultCashAccount,
    names: new Map(), opening: new Map(),
  };
  const clearingCodes = new Set([s.defaultPosAccount, s.tabbyAccount, s.tamaraAccount].filter(Boolean));
  for (const a of accounts) {
    c.names.set(a.code, a.name);
    c.opening.set(a.code, (a.openingDebit ?? 0) - (a.openingCredit ?? 0));
    if (a.mainAccount === "CASH" || a.mainAccount === "BANKS") {
      c.money.add(a.code);
      if (clearingCodes.has(a.code)) c.clearing.add(a.code);
    }
    // Student receivables live under 10103. "Security Deposits" (1010400001)
    // is filed under the same parent but is not money customers owe.
    if (a.parentCode === "10103" && a.code.startsWith("10103")) c.receivable.add(a.code);
    if (a.type === "Liability" && (a.mainAccount === "Accounts Payable" || a.parentCode === "20102" || a.parentCode === "201")) {
      c.payable.add(a.code);
    }
    if (a.type === "Revenue") c.revenue.add(a.code);
    if (a.type === "Expense") c.expense.add(a.code);
  }
  return c;
}

// ── Summary ──────────────────────────────────────────────────────────────────

export interface OwnerFinanceSummary {
  period: { from: string; to: string };
  metrics: Record<MetricKey, number>;
  detail: {
    recognisedExpenses: number;
    otherMoneyIn: number;
    clearingCash: number;
    customerAdvances: number;
    outputVat: number;
    inputVat: number;
  };
  /** Earned revenue vs recognised expenses per UAE month — same definitions as the cards. */
  monthly: { month: string; revenue: number; expenses: number; net: number }[];
  revenueByCourse: { name: string; value: number }[];
  expensesByAccount: { code: string; name: string; total: number }[];
  topReceivables: { code: string; name: string; balance: number }[];
  /** Account used for cash drill-downs. */
  cashAccount: string;
  generatedAt: string;
}

const ACTIVE = { status: "Posted", sourceType: { $ne: "Reversal" } };

/**
 * Figures for a period. `from`/`to` are UAE calendar days (YYYY-MM-DD); pass
 * empty strings for all time. Balance cards are "as of" the end of `to`
 * (or now, for all time).
 */
export async function getOwnerFinanceSummary({ from = "", to = "" }: { from?: string; to?: string }): Promise<OwnerFinanceSummary> {
  const start = DAY.test(from) ? dayStart(from) : undefined;
  const end = DAY.test(to) ? dayEnd(to) : undefined;
  const acc = await classifyAccounts();
  const moneyCodes = [...acc.money];
  const plCodes = [...acc.revenue, ...acc.expense];

  const dateRange: Record<string, Date> = {};
  if (start) dateRange.$gte = start;
  if (end) dateRange.$lte = end;
  const periodMatch = { ...ACTIVE, ...(start || end ? { date: dateRange } : {}) };

  // Six UAE months ending with the period's last month
  const endMonth = (DAY.test(to) ? to : uaeDate()).slice(0, 7);
  const [ey, em] = endMonth.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(ey, em - 1 - 5 + i, 1));
    return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  });
  const lastMonthEnd = new Date(Date.UTC(ey, em, 0)); // last day of end month
  const chartStart = dayStart(`${months[0].key}-01`);
  const chartEnd = dayEnd(lastMonthEnd.toISOString().slice(0, 10));

  const [flows, asOf, monthlyRows, courseRows] = await Promise.all([
    // Period movements per account, split by receipt/other and internal transfer
    JournalEntry.aggregate<{ _id: { code: string; receipt: boolean; transfer: boolean }; debit: number; credit: number }>([
      { $match: periodMatch },
      {
        $project: {
          lines: 1,
          receipt: { $eq: ["$sourceType", "Receipt"] },
          // An entry touching only money accounts moves cash between Nitaq's
          // own accounts: it is neither money in nor money out.
          transfer: {
            $eq: [{ $size: { $filter: { input: "$lines", cond: { $not: [{ $in: ["$$this.accountCode", moneyCodes] }] } } } }, 0],
          },
        },
      },
      { $unwind: "$lines" },
      {
        $group: {
          _id: { code: "$lines.accountCode", receipt: "$receipt", transfer: "$transfer" },
          debit: { $sum: "$lines.debit" },
          credit: { $sum: "$lines.credit" },
        },
      },
    ]),
    // Balances as of the end of the period
    JournalEntry.aggregate<{ _id: string; debit: number; credit: number }>([
      { $match: { ...ACTIVE, ...(end ? { date: { $lte: end } } : {}) } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.accountCode", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
    ]),
    // Monthly earned revenue vs recognised expenses, UAE months
    JournalEntry.aggregate<{ _id: { month: string; code: string }; debit: number; credit: number }>([
      { $match: { ...ACTIVE, date: { $gte: chartStart, $lte: chartEnd } } },
      { $unwind: "$lines" },
      { $match: { "lines.accountCode": { $in: plCodes } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: TZ } }, code: "$lines.accountCode" },
          debit: { $sum: "$lines.debit" },
          credit: { $sum: "$lines.credit" },
        },
      },
    ]),
    // Earned revenue by course (course stamped on the line; account name otherwise)
    JournalEntry.aggregate<{ _id: string; value: number }>([
      { $match: periodMatch },
      { $unwind: "$lines" },
      { $match: { "lines.accountCode": { $in: [...acc.revenue] } } },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$lines.courseRef", ""] } }, 0] },
              "$lines.courseRef",
              "$lines.accountName",
            ],
          },
          value: { $sum: { $subtract: ["$lines.credit", "$lines.debit"] } },
        },
      },
      { $sort: { value: -1 } },
      { $limit: 6 },
    ]),
  ]);

  let earnedRevenue = 0, recognisedExpenses = 0, outputVat = 0, inputVat = 0;
  let cashCollected = 0, otherMoneyIn = 0, moneyOut = 0;
  const expenseByCode = new Map<string, number>();
  for (const r of flows) {
    const { code, receipt, transfer } = r._id;
    const d = r.debit ?? 0;
    const cr = r.credit ?? 0;
    if (acc.revenue.has(code)) earnedRevenue += cr - d;
    if (acc.expense.has(code)) {
      recognisedExpenses += d - cr;
      expenseByCode.set(code, (expenseByCode.get(code) ?? 0) + d - cr);
    }
    if (code === acc.outputVat) outputVat += cr - d;
    if (code === acc.inputVat) inputVat += d - cr;
    if (acc.money.has(code) && !transfer) {
      if (receipt) cashCollected += d;
      else otherMoneyIn += d;
      moneyOut += cr;
    }
  }

  const balance = new Map<string, number>();
  for (const code of acc.opening.keys()) balance.set(code, acc.opening.get(code) ?? 0);
  for (const r of asOf) balance.set(r._id, (balance.get(r._id) ?? 0) + (r.debit ?? 0) - (r.credit ?? 0));
  const sumOf = (codes: Iterable<string>) => [...codes].reduce((s, code) => s + (balance.get(code) ?? 0), 0);

  const availableCash = sumOf(acc.money);
  const clearingCash = sumOf(acc.clearing);
  const customersOweUs = sumOf(acc.receivable);
  const weOwe = -sumOf(acc.payable);
  const customerAdvances = -(balance.get(acc.feesAdvance) ?? 0);

  const byMonth = new Map(months.map((m) => [m.key, { revenue: 0, expenses: 0 }]));
  for (const r of monthlyRows) {
    const bucket = byMonth.get(r._id.month);
    if (!bucket) continue;
    if (acc.revenue.has(r._id.code)) bucket.revenue += (r.credit ?? 0) - (r.debit ?? 0);
    if (acc.expense.has(r._id.code)) bucket.expenses += (r.debit ?? 0) - (r.credit ?? 0);
  }
  const spansYears = months[0].y !== months[5].y;

  return {
    period: { from: DAY.test(from) ? from : "", to: DAY.test(to) ? to : "" },
    metrics: {
      earnedRevenue: round2(earnedRevenue),
      cashCollected: round2(cashCollected),
      netProfit: round2(earnedRevenue - recognisedExpenses),
      availableCash: round2(availableCash),
      customersOweUs: round2(customersOweUs),
      weOwe: round2(weOwe),
      moneyOut: round2(moneyOut),
      vatEstimate: round2(outputVat - inputVat),
    },
    detail: {
      recognisedExpenses: round2(recognisedExpenses),
      otherMoneyIn: round2(otherMoneyIn),
      clearingCash: round2(clearingCash),
      customerAdvances: round2(customerAdvances),
      outputVat: round2(outputVat),
      inputVat: round2(inputVat),
    },
    monthly: months.map((m) => {
      const b = byMonth.get(m.key)!;
      return {
        month: spansYears ? `${MONTH_NAMES[m.m - 1]} ${String(m.y).slice(2)}` : MONTH_NAMES[m.m - 1],
        revenue: round2(b.revenue),
        expenses: round2(b.expenses),
        net: round2(b.revenue - b.expenses),
      };
    }),
    revenueByCourse: courseRows
      .map((r) => ({ name: r._id || "Other", value: round2(r.value) }))
      .filter((r) => Math.abs(r.value) >= 0.01),
    expensesByAccount: [...expenseByCode]
      .map(([code, total]) => ({ code, name: acc.names.get(code) ?? code, total: round2(total) }))
      .filter((e) => Math.abs(e.total) >= 0.01)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    topReceivables: [...acc.receivable]
      .map((code) => ({ code, name: acc.names.get(code) ?? code, balance: round2(balance.get(code) ?? 0) }))
      .filter((r) => r.balance >= 0.01)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8),
    cashAccount: acc.cashAccount,
    generatedAt: new Date().toISOString(),
  };
}
