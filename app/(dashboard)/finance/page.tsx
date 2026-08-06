import Link from "next/link";
import { Suspense } from "react";
import connectDB from "@/lib/db";
import { Payment, Expense } from "@/models/Financial";
import Enrollment from "@/models/Enrollment";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import JournalEntry from "@/models/accounting/JournalEntry";
import { buildDateFilter as _bdf } from "@/lib/dateRange";

/**
 * Recognised (accrual) revenue = net credits to Revenue-type accounts from
 * ACTIVE posted journal entries. This is the same figure the Trial Balance
 * and Invoices module show, so Finance reconciles with accounting.
 */
async function accrualRevenue(from?: string, to?: string): Promise<number> {
  const revAccounts = await ChartOfAccount.find({ type: "Revenue" }).select("code").lean();
  const codes = revAccounts.map((a) => a.code);
  if (codes.length === 0) return 0;
  const match: Record<string, unknown> = {
    status: "Posted", sourceType: { $ne: "Reversal" },
    "lines.accountCode": { $in: codes },
  };
  const df = _bdf(from, to);
  if (df) match.date = df;
  const rows = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: "$lines" },
    { $match: { "lines.accountCode": { $in: codes } } },
    { $group: { _id: null, credit: { $sum: "$lines.credit" }, debit: { $sum: "$lines.debit" } } },
  ]);
  return Math.round(((rows[0]?.credit ?? 0) - (rows[0]?.debit ?? 0)) * 100) / 100;
}
import { CreditCard, Receipt, ArrowRight, BarChart3 } from "lucide-react";
import { RevenueExpensesChart, CourseRevenuePieChart } from "@/components/finance/FinanceCharts";
import UrlDateFilter from "@/components/shared/UrlDateFilter";
import { buildDateFilter, describeRange } from "@/lib/dateRange";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";
import { Lamp } from "@/components/ui/lamp";
import { LoadError } from "@/components/ui/feedback";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PIE_COLOR_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

async function getFinanceData(from: string, to: string) {
  try {
    await connectDB();

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const dateFilter = buildDateFilter(from || undefined, to || undefined);

    const [
      periodRevenue,
      totalPending,
      periodExpenses,
      allTimeRevenue,
      monthlyRevenueByMonth,
      monthlyExpensesByMonth,
      courseRevenue,
      expensesByCategory,
      studentsWithBalance,
      overduePayments,
    ] = await Promise.all([
      // Recognised revenue for the period (accrual — matches TB & Invoices)
      accrualRevenue(from || undefined, to || undefined),

      Payment.aggregate([
        { $match: { status: { $in: ["Pending", "Overdue"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),

      Expense.aggregate([
        { $match: dateFilter ? { expenseDate: dateFilter } : {} },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),

      // All-time recognised revenue (accrual)
      accrualRevenue(),

      Payment.aggregate([
        { $match: { status: "Received", datePaid: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$datePaid" }, month: { $month: "$datePaid" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Expense.aggregate([
        { $match: { expenseDate: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$expenseDate" }, month: { $month: "$expenseDate" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Payment.aggregate([
        {
          $match: {
            status: "Received",
            course: { $exists: true, $ne: "" },
            ...(dateFilter ? { datePaid: dateFilter } : {}),
          },
        },
        { $group: { _id: "$course", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]),

      Expense.aggregate([
        { $match: dateFilter ? { expenseDate: dateFilter } : {} },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),

      Enrollment.aggregate([
        { $match: { status: "Active", $expr: { $gt: ["$totalFee", "$amountPaid"] } } },
        { $addFields: { balanceDue: { $subtract: ["$totalFee", "$amountPaid"] } } },
        { $sort: { balanceDue: -1 } },
        { $limit: 10 },
        { $project: { enrollmentId: 1, fullName: 1, course: 1, balanceDue: 1 } },
      ]),

      Payment.find({ status: "Overdue" })
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

    const monthlyChart = months.map(({ year, month }) => {
      const rev = monthlyRevenueByMonth.find(
        (r: { _id: { year: number; month: number }; total: number }) => r._id.year === year && r._id.month === month
      )?.total ?? 0;
      const exp = monthlyExpensesByMonth.find(
        (r: { _id: { year: number; month: number }; total: number }) => r._id.year === year && r._id.month === month
      )?.total ?? 0;
      return { month: MONTH_NAMES[month - 1], revenue: rev, expenses: exp, net: rev - exp };
    });

    return {
      periodRevenue,
      totalPending,
      periodExpenses,
      allTimeRevenue,
      periodNet: periodRevenue - periodExpenses,
      monthlyChart,
      courseRevenue: courseRevenue.map((c: { _id: string; total: number }) => ({ name: c._id ?? "Other", value: c.total })),
      expensesByCategory: expensesByCategory.map((e: { _id: string; total: number }) => ({ category: e._id ?? "Other", total: e.total })),
      studentsWithBalance: studentsWithBalance.map((e: { _id: { toString(): string }; enrollmentId: string; fullName: string; course: string; balanceDue: number }) => ({
        id: e._id.toString(),
        enrollmentId: e.enrollmentId ?? "",
        fullName: e.fullName ?? "",
        course: e.course ?? "",
        balanceDue: e.balanceDue ?? 0,
      })),
      overduePayments: overduePayments.map((p: { _id: { toString(): string }; studentName: string; course?: string; amount: number; dueDate?: Date; paymentType: string }) => ({
        id: p._id.toString(),
        studentName: p.studentName ?? "",
        course: p.course ?? "",
        amount: p.amount ?? 0,
        dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : "",
        paymentType: p.paymentType ?? "",
      })),
    };
  } catch {
    return null;
  }
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from = "", to = "" } = await searchParams;
  const data = await getFinanceData(from, to);
  const isFiltered = Boolean(from || to);
  const periodLabel = isFiltered ? describeRange(from, to) : "All Time";

  if (!data) {
    return (
      <div>
        <PageHeader title="Finance" subtitle="Revenue, expenses, and financial performance" />
        <LoadError message="Couldn't load finance data. Refresh the page, or contact your administrator if it keeps failing." />
      </div>
    );
  }

  const maxExpense = Math.max(...data.expensesByCategory.map((e) => e.total), 1);

  const modules = [
    {
      href: "/payments",
      icon: CreditCard,
      title: "Receipts",
      desc: "Student receipts, instalments and dues",
    },
    {
      href: "/expenses",
      icon: Receipt,
      title: "Expenses",
      desc: "Rent, salaries, marketing, utilities",
    },
    {
      href: "/reports",
      icon: BarChart3,
      title: "Full Reports",
      desc: "Leads, enrollments, revenue analytics",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle={isFiltered ? `Filtered: ${periodLabel}` : "Revenue, expenses, and financial performance"}
        actions={
          <Suspense fallback={null}>
            <UrlDateFilter />
          </Suspense>
        }
      />

      <div className="space-y-5">
        {/* Instrument row */}
        <InstrumentRow className="md:grid-cols-3 xl:grid-cols-5">
          <Instrument
            label={isFiltered ? `Revenue (${periodLabel})` : "Total Revenue"}
            value={fmt(data.periodRevenue)}
            sub={isFiltered ? "Recognised in period" : "All recognised revenue"}
            tone="phos"
          />
          <Instrument
            label={isFiltered ? `Expenses (${periodLabel})` : "Total Expenses"}
            value={fmt(data.periodExpenses)}
            sub={isFiltered ? "Costs in period" : "All time"}
          />
          <Instrument
            label={isFiltered ? `Net (${periodLabel})` : "Net Income"}
            value={fmt(data.periodNet)}
            sub="Revenue minus expenses"
            tone={data.periodNet >= 0 ? "phos" : "alert"}
          />
          <Instrument
            label="Pending / Overdue"
            value={fmt(data.totalPending)}
            sub="Not yet collected (all time)"
            tone="caution"
            href="/payments?status=Overdue"
          />
          <Instrument
            label="All-Time Revenue"
            value={fmt(data.allTimeRevenue)}
            sub="Total recognised ever"
          />
        </InstrumentRow>

        {/* Charts row */}
        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Revenue vs Expenses</CardTitle>
                <CardDescription>Last 6 months, cash received vs costs</CardDescription>
              </div>
              <div className="flex gap-4 text-xs text-dim">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-lamp" style={{ background: "var(--chart-1)" }} />
                  Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-lamp" style={{ background: "var(--chart-5)" }} />
                  Expenses
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {data.monthlyChart.every((m) => m.revenue === 0 && m.expenses === 0) ? (
                <div className="flex h-52 items-center justify-center rounded-ctl bg-well text-sm text-faint">
                  No financial activity recorded in the last six months.
                </div>
              ) : (
                <RevenueExpensesChart data={data.monthlyChart} />
              )}
              <div className="mt-4 flex items-center justify-between rounded-ctl bg-well px-4 py-3">
                <span className="placard">{isFiltered ? `Net (${periodLabel})` : "Net This Period"}</span>
                <span
                  className={`readout text-lg font-bold ${data.periodNet >= 0 ? "text-phos" : "text-alert"}`}
                  data-numeric
                >
                  {data.periodNet >= 0 ? "+" : ""}{fmt(data.periodNet)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Revenue by Course</CardTitle>
                <CardDescription>{isFiltered ? periodLabel : "All received payments"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {data.courseRevenue.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-ctl bg-well text-sm text-faint">
                  No receipts recorded yet
                </div>
              ) : (
                <>
                  <CourseRevenuePieChart data={data.courseRevenue} />
                  <ul className="mt-3 space-y-1.5">
                    {data.courseRevenue.map((c, i) => (
                      <li key={c.name} className="flex items-center justify-between text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2 w-2 flex-shrink-0 rounded-lamp"
                            style={{ background: PIE_COLOR_VARS[i % PIE_COLOR_VARS.length] }}
                          />
                          <span className="truncate text-dim" title={c.name}>{c.name}</span>
                        </span>
                        <span className="readout ml-2 flex-shrink-0 text-ink" data-numeric>{fmt(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Outstanding balances + Overdue receipts */}
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Outstanding Balances</CardTitle>
                <CardDescription>Active enrollments with unpaid fees, largest first</CardDescription>
              </div>
              <Link
                href="/enrollments"
                className="rounded-ctl border border-bezel-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-well"
              >
                All Enrollments
              </Link>
            </CardHeader>
            <CardContent>
              {data.studentsWithBalance.length === 0 ? (
                <p className="text-sm text-dim">No outstanding balances — all fees collected.</p>
              ) : (
                <ul className="space-y-2">
                  {data.studentsWithBalance.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-ctl border border-bezel bg-well px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{e.fullName}</p>
                        <p className="truncate text-xs text-faint">{e.course || "—"}</p>
                      </div>
                      <span className="readout ml-3 flex-shrink-0 text-sm font-bold text-caution" data-numeric>
                        {fmt(e.balanceDue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Overdue Receipts
                  {data.overduePayments.length > 0 && (
                    <Lamp variant="alert">{data.overduePayments.length} overdue</Lamp>
                  )}
                </CardTitle>
                <CardDescription>Receipts past their due date</CardDescription>
              </div>
              <Link
                href="/payments?status=Overdue"
                className="rounded-ctl border border-bezel-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-well"
              >
                View All
              </Link>
            </CardHeader>
            <CardContent>
              {data.overduePayments.length === 0 ? (
                <p className="text-sm text-dim">No overdue receipts.</p>
              ) : (
                <ul className="space-y-2">
                  {data.overduePayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{p.studentName}</p>
                        <p className="truncate text-xs text-faint">{p.course || p.paymentType}</p>
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right">
                        <p className="readout text-sm font-bold text-alert" data-numeric>{fmt(p.amount)}</p>
                        {p.dueDate && <p className="text-xs text-faint">Due {p.dueDate}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Expenses breakdown + module links */}
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>{isFiltered ? periodLabel : "All time breakdown"}</CardDescription>
              </div>
              <Link
                href="/expenses"
                className="rounded-ctl border border-bezel-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-well"
              >
                All Expenses
              </Link>
            </CardHeader>
            <CardContent>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-sm text-dim">No expenses recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.expensesByCategory.map((e) => {
                    const pct = Math.round((e.total / maxExpense) * 100);
                    return (
                      <div key={e.category}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="text-sm text-ink">{e.category}</span>
                          <span className="readout text-sm text-ink" data-numeric>{fmt(e.total)}</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${e.category} share of largest category`}
                          className="h-2 overflow-hidden rounded-sm bg-well"
                        >
                          <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: "var(--chart-5)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Finance Modules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="group flex items-center gap-4 rounded-ctl border border-bezel bg-well p-4 transition-colors hover:border-phos/60"
                  >
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-ctl border border-bezel bg-face">
                      <Icon className="h-5 w-5 text-phos" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{m.title}</span>
                      <span className="block truncate text-xs text-dim">{m.desc}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-phos" aria-hidden />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
