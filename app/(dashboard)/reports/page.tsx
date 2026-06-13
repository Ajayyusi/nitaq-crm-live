import { auth } from "@/auth";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import FollowUp from "@/models/FollowUp";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";
import {
  BarChart3, TrendingUp, Users, CreditCard, TrendingDown,
  GraduationCap, BookOpen, PhoneCall, Target,
} from "lucide-react";
import { Suspense } from "react";
import ReportFilter from "./ReportFilter";
import type { AppRole } from "@/lib/permissions";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function dateRange(from?: string, to?: string): { $gte?: Date; $lte?: Date } | undefined {
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to + "T23:59:59") : null;
  if (!f && !t) return undefined;
  const range: { $gte?: Date; $lte?: Date } = {};
  if (f) range.$gte = f;
  if (t) range.$lte = t;
  return range;
}

async function getReportData(from?: string, to?: string) {
  try {
    await connectDB();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const datePaidFilter = dateRange(from, to);
    const createdFilter  = dateRange(from, to);

    const paymentMatch = {
      status: "Received",
      paymentType: { $ne: "Refund" },
      ...(datePaidFilter ? { datePaid: datePaidFilter } : {}),
    };

    const [
      leadsByStage,
      leadsBySource,
      leadsInPeriod,
      followUpsByStatus,
      overdueFollowUps,
      enrollmentsByStatus,
      enrollmentsByCourse,
      revenueThisMonth,
      revenuePrevMonth,
      revenueFiltered,
      expenseFiltered,
      expensesByCategory,
      attendanceSessions,
      paymentsByMethod,
      outstandingBalance,
      pendingPayments,
    ] = await Promise.all([
      Lead.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
      createdFilter
        ? Lead.countDocuments({ createdAt: createdFilter })
        : Lead.countDocuments(),
      FollowUp.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      FollowUp.countDocuments({
        status: { $in: ["Pending", "No Response"] },
        followUpDate: { $lt: now },
      }),
      Enrollment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Enrollment.aggregate([
        { $group: { _id: "$course", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Payment.aggregate([
        { $match: { status: "Received", paymentType: { $ne: "Refund" }, datePaid: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Payment.aggregate([
        { $match: { status: "Received", paymentType: { $ne: "Refund" }, datePaid: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Payment.aggregate([
        { $match: paymentMatch },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Expense.aggregate([
        ...(datePaidFilter ? [{ $match: { expenseDate: datePaidFilter } }] : []),
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Expense.aggregate([
        ...(datePaidFilter ? [{ $match: { expenseDate: datePaidFilter } }] : []),
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),
      AttendanceSession.countDocuments(),
      Payment.aggregate([
        { $match: { status: "Received" } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),
      Enrollment.aggregate([
        { $group: { _id: null, outstanding: { $sum: { $subtract: ["$totalFee", "$amountPaid"] } } } },
      ]).then((r) => r[0]?.outstanding ?? 0),
      Payment.countDocuments({ status: "Pending" }),
    ]);

    const revenueTotal = revenueFiltered;
    const expenseTotal = expenseFiltered;

    return {
      leadsByStage: leadsByStage as { _id: string; count: number }[],
      leadsBySource: leadsBySource as { _id: string; count: number }[],
      leadsInPeriod,
      followUpsByStatus: followUpsByStatus as { _id: string; count: number }[],
      overdueFollowUps,
      enrollmentsByStatus: enrollmentsByStatus as { _id: string; count: number }[],
      enrollmentsByCourse: enrollmentsByCourse as { _id: string; count: number }[],
      revenueThisMonth, revenuePrevMonth,
      revenueTotal, expenseTotal,
      net: revenueTotal - expenseTotal,
      expensesByCategory: expensesByCategory as { _id: string; total: number }[],
      attendanceSessions,
      paymentsByMethod: paymentsByMethod as { _id: string; total: number }[],
      outstandingBalance,
      pendingPayments,
      isFiltered: Boolean(from || to),
    };
  } catch {
    return null;
  }
}

function StatCard({ icon: Icon, label, value, sub, color = "text-[#2E7D32]" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color = "bg-[#2E7D32]", suffix }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const display = suffix ? fmt(value) : value;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-slate-600 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-[#0D1F0E] w-20 text-right">{display}</span>
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  Lead: "bg-sky-400", Contacted: "bg-blue-400", Interested: "bg-[#2E7D32]",
  Enrolled: "bg-[#00897B]", Paid: "bg-emerald-500", Lost: "bg-rose-400",
};

const FOLLOW_UP_COLORS: Record<string, string> = {
  Pending: "bg-amber-400", Done: "bg-[#2E7D32]",
  "No Response": "bg-rose-400", Rescheduled: "bg-slate-400",
};

import AttendanceSession from "@/models/Attendance";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  const rawRole = (session?.user as { role?: string })?.role;
  const role = (rawRole === "staff" ? "sales" : rawRole) as AppRole | undefined;

  const showFinance = role === "admin" || role === "manager" || role === "finance";
  const showSales   = role === "admin" || role === "manager";

  const { from, to } = await searchParams;
  const data = await getReportData(from, to);

  const periodLabel = from || to
    ? `${from ?? "start"} → ${to ?? "today"}`
    : "All time";

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#0D1F0E] mb-2">Reports</h1>
        <p className="text-sm text-slate-500">Could not load report data. Please check your database connection.</p>
      </div>
    );
  }

  const leadTotal = data.leadsByStage.reduce((s, r) => s + r.count, 0);
  const enrollTotal = data.enrollmentsByStatus.reduce((s, r) => s + r.count, 0);
  const followUpTotal = data.followUpsByStatus.reduce((s, r) => s + r.count, 0);
  const enrolledLeads = data.leadsByStage.find((r) => r._id === "Enrolled")?.count ?? 0;
  const conversionRate = leadTotal > 0 ? Math.round((enrolledLeads / leadTotal) * 100) : 0;
  const momChange = data.revenuePrevMonth > 0
    ? Math.round(((data.revenueThisMonth - data.revenuePrevMonth) / data.revenuePrevMonth) * 100)
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-5xl">
      {/* Header + Filter */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1F0E]">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data.isFiltered ? `Filtered: ${periodLabel}` : "All time — use filters to narrow by date"}
          </p>
        </div>
        <Suspense fallback={null}>
          <ReportFilter />
        </Suspense>
      </div>

      {/* Financial Summary — admin, manager, finance */}
      {showFinance && (
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Financial Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={TrendingUp}
              label="This Month"
              value={fmt(data.revenueThisMonth)}
              sub={momChange != null ? `${momChange >= 0 ? "+" : ""}${momChange}% vs last month` : "First month"}
              color="text-[#2E7D32]"
            />
            <StatCard
              icon={TrendingUp}
              label={data.isFiltered ? "Revenue (period)" : "Total Revenue"}
              value={fmt(data.revenueTotal)}
              color="text-[#2E7D32]"
            />
            <StatCard
              icon={TrendingDown}
              label={data.isFiltered ? "Expenses (period)" : "Total Expenses"}
              value={fmt(data.expenseTotal)}
              color="text-red-700"
            />
            <StatCard
              icon={BarChart3}
              label="Net Income"
              value={fmt(data.net)}
              color={data.net >= 0 ? "text-[#2E7D32]" : "text-red-700"}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* Outstanding & Pending */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-[#0D1F0E]">Outstanding Balances</p>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Total outstanding (enrollments)</span>
                <span className="text-sm font-bold text-amber-700">{fmt(data.outstandingBalance)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600">Pending payment records</span>
                <span className="text-sm font-bold text-slate-700">{data.pendingPayments}</span>
              </div>
            </div>

            {/* Revenue by Payment Method */}
            {data.paymentsByMethod.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-[#0D1F0E] mb-4">Revenue by Payment Method</p>
                <div className="space-y-3">
                  {data.paymentsByMethod.map((r) => (
                    <div key={r._id} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-slate-600 flex-shrink-0">{r._id}</span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2E7D32]"
                          style={{ width: `${data.revenueTotal > 0 ? Math.max(4, Math.round((r.total / data.revenueTotal) * 100)) : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-[#0D1F0E] w-24 text-right">{fmt(r.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expenses by Category */}
          {data.expensesByCategory.length > 0 && (
            <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#0D1F0E] mb-4">Expenses by Category</p>
              <div className="space-y-3">
                {data.expensesByCategory.map((r) => (
                  <BarRow
                    key={r._id}
                    label={r._id ?? "Other"}
                    value={r.total}
                    max={data.expensesByCategory[0]?.total ?? 1}
                    color="bg-red-400"
                    suffix="AED"
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Sales / Pipeline — admin, manager */}
      {showSales && (
        <>
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Lead Pipeline ({leadTotal})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard icon={Users} label="Total Leads" value={leadTotal} />
              <StatCard
                icon={Target}
                label="Conversion Rate"
                value={`${conversionRate}%`}
                sub={`${enrolledLeads} enrolled`}
                color={conversionRate >= 20 ? "text-[#2E7D32]" : "text-amber-700"}
              />
              <StatCard
                icon={TrendingUp}
                label="New This Period"
                value={data.leadsInPeriod}
                sub={data.isFiltered ? "in selected range" : "all time"}
              />
              <StatCard
                icon={PhoneCall}
                label="Overdue Follow-ups"
                value={data.overdueFollowUps}
                color={data.overdueFollowUps > 0 ? "text-rose-600" : "text-[#2E7D32]"}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-[#0D1F0E] mb-4">Leads by Stage</p>
                <div className="space-y-3">
                  {data.leadsByStage.sort((a, b) => b.count - a.count).map((r) => (
                    <BarRow
                      key={r._id}
                      label={r._id ?? "Unknown"}
                      value={r.count}
                      max={leadTotal}
                      color={STAGE_COLORS[r._id ?? ""] ?? "bg-slate-400"}
                    />
                  ))}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-[#0D1F0E] mb-4">Leads by Source</p>
                <div className="space-y-3">
                  {data.leadsBySource.sort((a, b) => b.count - a.count).map((r) => (
                    <BarRow key={r._id} label={r._id ?? "Unknown"} value={r.count} max={leadTotal} color="bg-[#00897B]" />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Follow-ups */}
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <PhoneCall className="w-4 h-4" /> Follow-ups ({followUpTotal})
            </h2>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="space-y-3">
                {data.followUpsByStatus.sort((a, b) => b.count - a.count).map((r) => (
                  <BarRow
                    key={r._id}
                    label={r._id ?? "Unknown"}
                    value={r.count}
                    max={followUpTotal}
                    color={FOLLOW_UP_COLORS[r._id ?? ""] ?? "bg-slate-400"}
                  />
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Enrollments — all roles that can access reports */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Enrollments ({enrollTotal})
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#0D1F0E] mb-4">By Status</p>
            <div className="space-y-3">
              {data.enrollmentsByStatus.sort((a, b) => b.count - a.count).map((r) => (
                <BarRow key={r._id} label={r._id ?? "Unknown"} value={r.count} max={enrollTotal} />
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#0D1F0E] mb-4">Top Courses by Enrollment</p>
            <div className="space-y-3">
              {data.enrollmentsByCourse.map((r) => (
                <BarRow
                  key={r._id}
                  label={r._id ?? "Unknown"}
                  value={r.count}
                  max={data.enrollmentsByCourse[0]?.count ?? 1}
                  color="bg-[#00897B]"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Attendance */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Attendance & Classes
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={BookOpen} label="Sessions Recorded" value={data.attendanceSessions} />
          <StatCard icon={Users} label="Active Enrollments" value={enrollTotal} />
          <StatCard
            icon={GraduationCap}
            label="Enrolled Leads"
            value={enrolledLeads}
            sub={`${conversionRate}% conversion rate`}
          />
        </div>
      </section>
    </div>
  );
}
