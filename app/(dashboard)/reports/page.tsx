import { auth } from "@/auth";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import FollowUp from "@/models/FollowUp";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";
import { getSettings } from "@/models/Settings";
import AttendanceSession from "@/models/Attendance";
import {
  BarChart3, TrendingUp, Users, CreditCard, TrendingDown,
  GraduationCap, BookOpen, PhoneCall, Target, AlertTriangle,
} from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import ReportFilter from "./ReportFilter";
import ExportButtons from "./ExportButtons";
import PageHeader from "@/components/shared/PageHeader";
import { Instrument } from "@/components/ui/instrument";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TableShell, Table, THead, Th, Tr, Td, TableFooter } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      revenueByCourse,
      studentBalances,
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

      Payment.aggregate([
        {
          $match: {
            status: "Received",
            paymentType: { $ne: "Refund" },
            course: { $exists: true, $ne: "" },
            ...(datePaidFilter ? { datePaid: datePaidFilter } : {}),
          },
        },
        { $group: { _id: "$course", revenue: { $sum: "$amount" }, payments: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 12 },
      ]),

      Enrollment.aggregate([
        { $match: { $expr: { $gt: ["$totalFee", "$amountPaid"] } } },
        { $addFields: { balanceDue: { $subtract: ["$totalFee", "$amountPaid"] } } },
        { $sort: { balanceDue: -1 } },
        { $limit: 25 },
        { $project: { enrollmentId: 1, fullName: 1, course: 1, totalFee: 1, amountPaid: 1, balanceDue: 1, paymentStatus: 1, status: 1 } },
      ]),
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
      revenueByCourse: revenueByCourse as { _id: string; revenue: number; payments: number }[],
      studentBalances: studentBalances as { _id: string; enrollmentId: string; fullName: string; course: string; totalFee: number; amountPaid: number; balanceDue: number; paymentStatus: string; status: string }[],
      isFiltered: Boolean(from || to),
    };
  } catch {
    return null;
  }
}

/** Honest horizontal bar: width is the real percentage, no cosmetic floor. */
function BarRow({ label, value, max, color = "var(--chart-1)", money }: {
  label: string; value: number; max: number; color?: string; money?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const display = money ? fmt(value) : value;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 flex-shrink-0 truncate text-sm text-dim" title={label}>{label}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-sm bg-well"
        role="img"
        aria-label={`${label}: ${display}`}
      >
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="readout w-24 flex-shrink-0 text-right text-sm font-semibold text-ink" data-numeric>
        {display}
      </span>
    </div>
  );
}

function SectionHeading({ icon: Icon, children }: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="placard mb-3 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5" aria-hidden /> {children}
    </h2>
  );
}

const STAGE_COLORS: Record<string, string> = {
  Lead: "var(--chart-2)", Contacted: "var(--chart-4)", Interested: "var(--chart-3)",
  Enrolled: "var(--chart-1)", Paid: "var(--chart-1)", Lost: "var(--chart-5)",
};

const FOLLOW_UP_COLORS: Record<string, string> = {
  Pending: "var(--chart-3)", Done: "var(--chart-1)",
  "No Response": "var(--chart-5)", Rescheduled: "var(--chart-4)",
};

const BALANCE_LAMP = (paymentStatus: string): LampVariant =>
  paymentStatus === "Overdue" ? "alert" : paymentStatus === "Paid Full" ? "ok" : "caution";

/* Print: the report stays black-on-white paper regardless of theme. */
const PRINT_OVERRIDES = `@media print{
  [data-report-root]{
    --panel:#fff;--face:#fff;--raised:#fff;--well:#f3f3f3;
    --bezel:#d5d5d5;--bezel-strong:#aaa;
    --ink:#000;--dim:#333;--faint:#555;
    --phos:#0b6b43;--phos-bright:#0b6b43;--phos-ink:#fff;
    --caution:#8a5a00;--caution-fill:#8a5a00;--alert:#b3261e;--advisory:#0c5a78;
    --lamp-ok-bg:#eef7f1;--lamp-caution-bg:#fbf3e2;--lamp-alert-bg:#fdecea;
    --lamp-advisory-bg:#e8f4f9;--lamp-off-bg:#f0f0f0;
    --shadow-card:none;--shadow-raise:none;--shadow-glow:none;
  }
}`;

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
  const [data, settings] = await Promise.all([
    getReportData(from, to),
    getSettings().catch(() => null),
  ]);
  const academyName = settings?.academyNameEn ?? "Nitaq Academy";

  const periodLabel = from || to
    ? `${from ?? "start"} → ${to ?? "today"}`
    : "All time";

  if (!data) {
    return (
      <div>
        <PageHeader title="Reports" subtitle={academyName} />
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-6 py-14 text-center"
        >
          <AlertTriangle className="h-5 w-5 text-alert" aria-hidden />
          <p className="text-sm font-semibold text-ink">Couldn&apos;t load report data.</p>
          <p className="text-xs text-dim">Try again, or contact your administrator if this keeps happening.</p>
          <Link href="/reports" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Retry
          </Link>
        </div>
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
    <div className="space-y-8" data-report-root>
      <style>{PRINT_OVERRIDES}</style>

      <div>
        <PageHeader
          title="Reports"
          subtitle={`${academyName} · ${data.isFiltered ? `Filtered: ${periodLabel}` : "All time — use the date filter to narrow the period"}`}
          actions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Suspense fallback={null}>
                <ReportFilter />
              </Suspense>
              <Suspense fallback={null}>
                <ExportButtons />
              </Suspense>
            </div>
          }
        />
      </div>

      {/* Financial Summary — admin, manager, finance */}
      {showFinance && (
        <section>
          <SectionHeading icon={CreditCard}>Financial Summary</SectionHeading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Instrument
              label="This Month"
              value={fmt(data.revenueThisMonth)}
              sub={momChange != null ? `${momChange >= 0 ? "+" : ""}${momChange}% vs last month` : "First month"}
              tone="phos"
              corner={<TrendingUp className="h-4 w-4 text-faint" aria-hidden />}
            />
            <Instrument
              label={data.isFiltered ? "Revenue (Period)" : "Total Revenue"}
              value={fmt(data.revenueTotal)}
              tone="phos"
              corner={<TrendingUp className="h-4 w-4 text-faint" aria-hidden />}
            />
            <Instrument
              label={data.isFiltered ? "Expenses (Period)" : "Total Expenses"}
              value={fmt(data.expenseTotal)}
              tone="ink"
              corner={<TrendingDown className="h-4 w-4 text-faint" aria-hidden />}
            />
            <Instrument
              label="Net Income"
              value={fmt(data.net)}
              tone={data.net >= 0 ? "phos" : "alert"}
              corner={<BarChart3 className="h-4 w-4 text-faint" aria-hidden />}
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {/* Outstanding & Pending */}
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between border-b border-bezel/60 py-2">
                  <span className="text-sm text-dim">Total outstanding (enrollments)</span>
                  <span className="readout text-sm font-bold text-caution" data-numeric>
                    {fmt(data.outstandingBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-dim">Pending payment records</span>
                  <span className="readout text-sm font-bold text-ink" data-numeric>
                    {data.pendingPayments}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Payment Method */}
            {data.paymentsByMethod.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.paymentsByMethod.map((r) => (
                    <BarRow
                      key={r._id}
                      label={r._id}
                      value={r.total}
                      max={data.revenueTotal}
                      money
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Expenses by Category */}
          {data.expensesByCategory.length > 0 && (
            <Card className="mt-3">
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.expensesByCategory.map((r) => (
                  <BarRow
                    key={r._id}
                    label={r._id ?? "Other"}
                    value={r.total}
                    max={data.expensesByCategory[0]?.total ?? 1}
                    color="var(--chart-5)"
                    money
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Revenue by Course — finance / admin / manager */}
      {showFinance && data.revenueByCourse.length > 0 && (
        <section>
          <SectionHeading icon={BookOpen}>Revenue by Course</SectionHeading>
          <Card>
            <CardHeader>
              <CardTitle>
                {data.isFiltered ? `Revenue per course (${periodLabel})` : "All-time revenue per course"}
              </CardTitle>
              <span className="readout text-xs text-faint" data-numeric>
                {data.revenueByCourse.length} courses
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.revenueByCourse.map((r) => {
                const maxRev = data.revenueByCourse[0]?.revenue ?? 1;
                const pct = maxRev > 0 ? (r.revenue / maxRev) * 100 : 0;
                return (
                  <div key={r._id} className="flex items-center gap-3">
                    <span className="w-44 flex-shrink-0 truncate text-sm text-dim" title={r._id || undefined}>
                      {r._id || "—"}
                    </span>
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-sm bg-well"
                      role="img"
                      aria-label={`${r._id || "Unnamed course"}: ${fmt(r.revenue)}`}
                    >
                      <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: "var(--chart-1)" }} />
                    </div>
                    <div className="w-36 flex-shrink-0 text-right">
                      <span className="readout text-sm font-semibold text-ink" data-numeric>{fmt(r.revenue)}</span>
                      <span className="readout ml-2 text-xs text-faint" data-numeric>({r.payments})</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <div className="flex items-center justify-between border-t border-bezel bg-well px-4 py-2.5 sm:px-5">
              <span className="text-sm text-dim">Total across all courses</span>
              <span className="readout text-sm font-bold text-phos" data-numeric>
                {fmt(data.revenueByCourse.reduce((s, r) => s + r.revenue, 0))}
              </span>
            </div>
          </Card>
        </section>
      )}

      {/* Student Balance Report — finance / admin / manager */}
      {showFinance && data.studentBalances.length > 0 && (
        <section>
          <SectionHeading icon={CreditCard}>Student Balances</SectionHeading>
          <TableShell>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bezel px-4 py-3 sm:px-5">
              <p className="text-sm font-bold text-ink">Enrollments with outstanding balance</p>
              <span className="readout text-xs text-faint" data-numeric>
                {data.studentBalances.length} students
              </span>
            </div>
            <Table className="min-w-[580px]">
              <THead>
                <tr>
                  <Th>Student</Th>
                  <Th>Course</Th>
                  <Th numeric>Total Fee</Th>
                  <Th numeric>Paid</Th>
                  <Th numeric>Balance Due</Th>
                  <Th>Payment Status</Th>
                </tr>
              </THead>
              <tbody>
                {data.studentBalances.map((s) => (
                  <Tr key={s.enrollmentId || String(s._id)}>
                    <Td className="font-semibold">{s.fullName}</Td>
                    <Td className="max-w-40 truncate text-dim" title={s.course || undefined}>{s.course || "—"}</Td>
                    <Td numeric>{fmt(s.totalFee)}</Td>
                    <Td numeric className="text-phos">{fmt(s.amountPaid)}</Td>
                    <Td numeric className="font-bold text-caution">{fmt(s.balanceDue)}</Td>
                    <Td>
                      <Lamp variant={BALANCE_LAMP(s.paymentStatus)}>{s.paymentStatus}</Lamp>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <span>Total outstanding</span>
              <span className="readout font-bold text-caution" data-numeric>
                {fmt(data.studentBalances.reduce((s, r) => s + r.balanceDue, 0))}
              </span>
            </TableFooter>
          </TableShell>
        </section>
      )}

      {/* Sales / Pipeline — admin, manager */}
      {showSales && (
        <>
          <section>
            <SectionHeading icon={TrendingUp}>Lead Pipeline ({leadTotal})</SectionHeading>
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Instrument
                label="Total Leads"
                value={leadTotal}
                corner={<Users className="h-4 w-4 text-faint" aria-hidden />}
              />
              <Instrument
                label="Conversion Rate"
                value={`${conversionRate}%`}
                sub={`${enrolledLeads} enrolled`}
                tone={conversionRate >= 20 ? "phos" : "caution"}
                corner={<Target className="h-4 w-4 text-faint" aria-hidden />}
              />
              <Instrument
                label="New This Period"
                value={data.leadsInPeriod}
                sub={data.isFiltered ? "In selected range" : "All time"}
                corner={<TrendingUp className="h-4 w-4 text-faint" aria-hidden />}
              />
              <Instrument
                label="Overdue Follow-Ups"
                value={data.overdueFollowUps}
                tone={data.overdueFollowUps > 0 ? "alert" : "phos"}
                corner={<PhoneCall className="h-4 w-4 text-faint" aria-hidden />}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Leads by Stage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.leadsByStage.sort((a, b) => b.count - a.count).map((r) => (
                    <BarRow
                      key={r._id}
                      label={r._id ?? "Unknown"}
                      value={r.count}
                      max={leadTotal}
                      color={STAGE_COLORS[r._id ?? ""] ?? "var(--chart-4)"}
                    />
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Leads by Source</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.leadsBySource.sort((a, b) => b.count - a.count).map((r) => (
                    <BarRow
                      key={r._id}
                      label={r._id ?? "Unknown"}
                      value={r.count}
                      max={leadTotal}
                      color="var(--chart-2)"
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Follow-ups */}
          <section>
            <SectionHeading icon={PhoneCall}>Follow-Ups ({followUpTotal})</SectionHeading>
            <Card>
              <CardContent className="space-y-3">
                {data.followUpsByStatus.sort((a, b) => b.count - a.count).map((r) => (
                  <BarRow
                    key={r._id}
                    label={r._id ?? "Unknown"}
                    value={r.count}
                    max={followUpTotal}
                    color={FOLLOW_UP_COLORS[r._id ?? ""] ?? "var(--chart-4)"}
                  />
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* Enrollments — all roles that can access reports */}
      <section>
        <SectionHeading icon={GraduationCap}>Enrollments ({enrollTotal})</SectionHeading>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.enrollmentsByStatus.sort((a, b) => b.count - a.count).map((r) => (
                <BarRow key={r._id} label={r._id ?? "Unknown"} value={r.count} max={enrollTotal} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Courses by Enrollment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.enrollmentsByCourse.map((r) => (
                <BarRow
                  key={r._id}
                  label={r._id ?? "Unknown"}
                  value={r.count}
                  max={data.enrollmentsByCourse[0]?.count ?? 1}
                  color="var(--chart-2)"
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Attendance */}
      <section>
        <SectionHeading icon={BookOpen}>Attendance &amp; Classes</SectionHeading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Instrument
            label="Sessions Recorded"
            value={data.attendanceSessions}
            corner={<BookOpen className="h-4 w-4 text-faint" aria-hidden />}
          />
          <Instrument
            label="Active Enrollments"
            value={enrollTotal}
            corner={<Users className="h-4 w-4 text-faint" aria-hidden />}
          />
          <Instrument
            label="Enrolled Leads"
            value={enrolledLeads}
            sub={`${conversionRate}% conversion rate`}
            corner={<GraduationCap className="h-4 w-4 text-faint" aria-hidden />}
          />
        </div>
      </section>
    </div>
  );
}
