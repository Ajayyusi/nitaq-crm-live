import Link from "next/link";
import { Suspense } from "react";
import connectDB from "@/lib/db";
import { Payment, Expense } from "@/models/Financial";
import Enrollment from "@/models/Enrollment";
import { CreditCard, Receipt, TrendingDown, TrendingUp, ArrowRight, BarChart3, AlertTriangle, Users } from "lucide-react";
import { RevenueExpensesChart, CourseRevenuePieChart } from "@/components/finance/FinanceCharts";
import UrlDateFilter from "@/components/shared/UrlDateFilter";
import { buildDateFilter, describeRange } from "@/lib/dateRange";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
      Payment.aggregate([
        {
          $match: {
            status: "Received",
            paymentType: { $ne: "Refund" },
            ...(dateFilter ? { datePaid: dateFilter } : {}),
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),

      Payment.aggregate([
        { $match: { status: { $in: ["Pending", "Overdue"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),

      Expense.aggregate([
        { $match: dateFilter ? { expenseDate: dateFilter } : {} },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),

      Payment.aggregate([
        { $match: { status: "Received", paymentType: { $ne: "Refund" } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),

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
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#0D1F0E]">Finance</h1>
        <p className="mt-2 text-sm text-rose-600">Could not connect to database.</p>
      </div>
    );
  }

  const kpis = [
    {
      icon: TrendingUp,
      label: isFiltered ? `Revenue (${periodLabel})` : "Total Revenue",
      value: fmt(data.periodRevenue),
      sub: isFiltered ? "Received in period" : "All received payments",
      color: "#2E7D32",
    },
    {
      icon: TrendingDown,
      label: isFiltered ? `Expenses (${periodLabel})` : "Total Expenses",
      value: fmt(data.periodExpenses),
      sub: isFiltered ? "Costs in period" : "All time",
      color: "#EF5350",
    },
    {
      icon: BarChart3,
      label: isFiltered ? `Net (${periodLabel})` : "Net Income",
      value: fmt(data.periodNet),
      sub: "Revenue minus expenses",
      color: data.periodNet >= 0 ? "#2E7D32" : "#EF5350",
    },
    {
      icon: CreditCard,
      label: "Pending / Overdue",
      value: fmt(data.totalPending),
      sub: "Not yet collected (all time)",
      color: "#F59E0B",
    },
    {
      icon: TrendingUp,
      label: "All-Time Revenue",
      value: fmt(data.allTimeRevenue),
      sub: "Total received ever",
      color: "#2196F3",
    },
  ];

  const maxExpense = Math.max(...data.expensesByCategory.map((e) => e.total), 1);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">Business</p>
          <h1 className="mt-1 text-3xl font-bold text-[#0D1F0E]">Finance</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isFiltered ? `Filtered: ${periodLabel}` : "Revenue, expenses, and financial performance"}
          </p>
        </div>
        <Suspense fallback={null}>
          <UrlDateFilter />
        </Suspense>
      </div>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
                style={{ background: kpi.color }}
              />
              <div
                className="mb-3 grid h-10 w-10 place-items-center rounded-xl"
                style={{ background: kpi.color + "15", color: kpi.color }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className="mt-1.5 text-2xl font-bold" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Charts row */}
      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        {/* Revenue vs Expenses bar chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Revenue vs Expenses</h2>
              <p className="mt-0.5 text-xs text-slate-500">Last 6 months</p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-[#2E7D32]" /><span className="text-slate-600">Revenue</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-rose-400" /><span className="text-slate-600">Expenses</span></div>
            </div>
          </div>
          {data.monthlyChart.every((m) => m.revenue === 0 && m.expenses === 0) ? (
            <div className="flex h-52 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
              No financial data yet. Run the seed or add payments/expenses.
            </div>
          ) : (
            <RevenueExpensesChart data={data.monthlyChart} />
          )}
          {/* Monthly net row */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">
              {isFiltered ? `Net (${periodLabel})` : "Net this month"}
            </span>
            <span className={`text-lg font-bold ${data.periodNet >= 0 ? "text-[#2E7D32]" : "text-rose-600"}`}>
              {data.periodNet >= 0 ? "+" : ""}{fmt(data.periodNet)}
            </span>
          </div>
        </div>

        {/* Course revenue pie chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-[#0D1F0E]">Revenue by Course</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isFiltered ? periodLabel : "All received payments"}
            </p>
          </div>
          {data.courseRevenue.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
              No data yet
            </div>
          ) : (
            <>
              <CourseRevenuePieChart data={data.courseRevenue} />
              <div className="mt-3 space-y-1.5">
                {data.courseRevenue.slice(0, 4).map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ background: ["#2E7D32", "#00897B", "#2196F3", "#7B1FA2"][i] }}
                      />
                      <span className="truncate text-slate-600">{c.name}</span>
                    </div>
                    <span className="ml-2 flex-shrink-0 font-semibold text-[#0D1F0E]">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Outstanding balances + Overdue alerts */}
      <section className="grid gap-5 xl:grid-cols-2">
        {/* Students with outstanding balance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-[#0D1F0E]">
                <Users className="h-4 w-4 text-amber-500" />
                Outstanding Balances
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Active enrollments with unpaid balance</p>
            </div>
            <Link
              href="/enrollments"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              All Enrollments
            </Link>
          </div>
          {data.studentsWithBalance.length === 0 ? (
            <p className="text-sm text-slate-400">No outstanding balances — all fees collected.</p>
          ) : (
            <div className="space-y-2">
              {data.studentsWithBalance.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0D1F0E]">{e.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{e.course || "—"}</p>
                  </div>
                  <span className="ml-3 flex-shrink-0 text-sm font-bold text-amber-600">{fmt(e.balanceDue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue payments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-[#0D1F0E]">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Overdue Payments
                {data.overduePayments.length > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
                    {data.overduePayments.length}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Payments past their due date</p>
            </div>
            <Link
              href="/payments?status=Overdue"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-rose-300 hover:bg-rose-50"
            >
              View All
            </Link>
          </div>
          {data.overduePayments.length === 0 ? (
            <p className="text-sm text-slate-400">No overdue payments.</p>
          ) : (
            <div className="space-y-2">
              {data.overduePayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0D1F0E]">{p.studentName}</p>
                    <p className="truncate text-xs text-slate-500">{p.course || p.paymentType}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-rose-600">{fmt(p.amount)}</p>
                    {p.dueDate && (
                      <p className="text-xs text-slate-400">Due {p.dueDate}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Expenses breakdown + Quick links */}
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* Expenses by category */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Expenses by Category</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isFiltered ? periodLabel : "All time breakdown"}
              </p>
            </div>
            <Link
              href="/expenses"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              All Expenses
            </Link>
          </div>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-slate-400">No expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {data.expensesByCategory.map((e) => {
                const pct = Math.max(4, Math.round((e.total / maxExpense) * 100));
                return (
                  <div key={e.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{e.category}</span>
                      <span className="font-bold text-[#0D1F0E]">{fmt(e.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-rose-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick navigation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-bold text-[#0D1F0E]">Finance Modules</h2>
          <div className="space-y-3">
            <Link
              href="/payments"
              className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-5 transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-green-100">
                <CreditCard className="h-6 w-6 text-[#2E7D32]" />
              </div>
              <div>
                <p className="font-bold text-[#0D1F0E]">Payments</p>
                <p className="text-sm text-slate-500">Tuition, instalments, receipts</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-slate-300 transition group-hover:text-[#2E7D32]" />
            </Link>
            <Link
              href="/expenses"
              className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-5 transition hover:border-rose-300 hover:bg-rose-50"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-rose-100">
                <Receipt className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="font-bold text-[#0D1F0E]">Expenses</p>
                <p className="text-sm text-slate-500">Rent, salaries, marketing, utilities</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-slate-300 transition group-hover:text-rose-500" />
            </Link>
            <Link
              href="/reports"
              className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-5 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-100">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-[#0D1F0E]">Full Reports</p>
                <p className="text-sm text-slate-500">Leads, enrollments, revenue analytics</p>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-slate-300 transition group-hover:text-blue-500" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
