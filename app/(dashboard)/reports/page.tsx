import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";
import AttendanceSession from "@/models/Attendance";
import { BarChart3, TrendingUp, Users, CreditCard, TrendingDown, GraduationCap, BookOpen } from "lucide-react";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

async function getReportData() {
  try {
    await connectDB();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      leadsByStage,
      leadsBySource,
      enrollmentsByStatus,
      enrollmentsByCourse,
      revenueThisMonth,
      revenuePrevMonth,
      revenueTotal,
      expenseTotal,
      attendanceSessions,
      paymentsByMethod,
    ] = await Promise.all([
      Lead.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
      Enrollment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Enrollment.aggregate([{ $group: { _id: "$course", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      Payment.aggregate([
        { $match: { status: "Received", paymentType: { $ne: "Refund" }, datePaid: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Payment.aggregate([
        { $match: { status: "Received", paymentType: { $ne: "Refund" }, datePaid: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Payment.aggregate([
        { $match: { status: "Received", paymentType: { $ne: "Refund" } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Expense.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      AttendanceSession.countDocuments(),
      Payment.aggregate([
        { $match: { status: "Received" } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    return {
      leadsByStage: leadsByStage as { _id: string; count: number }[],
      leadsBySource: leadsBySource as { _id: string; count: number }[],
      enrollmentsByStatus: enrollmentsByStatus as { _id: string; count: number }[],
      enrollmentsByCourse: enrollmentsByCourse as { _id: string; count: number }[],
      revenueThisMonth, revenuePrevMonth, revenueTotal, expenseTotal,
      net: revenueTotal - expenseTotal,
      attendanceSessions,
      paymentsByMethod: paymentsByMethod as { _id: string; total: number }[],
    };
  } catch {
    return null;
  }
}

function StatCard({ icon: Icon, label, value, sub, color = "text-[#2E7D32]" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
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

function BarRow({ label, value, max, color = "bg-[#2E7D32]" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-slate-600 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-[#0D1F0E] w-8 text-right">{value}</span>
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  Lead: "bg-sky-400", Contacted: "bg-blue-400", Interested: "bg-[#2E7D32]",
  Enrolled: "bg-[#00897B]", Paid: "bg-emerald-500", Lost: "bg-rose-400",
};

export default async function ReportsPage() {
  const data = await getReportData();

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
  const momChange = data.revenuePrevMonth > 0
    ? Math.round(((data.revenueThisMonth - data.revenuePrevMonth) / data.revenuePrevMonth) * 100)
    : null;

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0D1F0E]">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Live summary across all modules</p>
      </div>

      {/* Financial overview */}
      <section>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
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
          <StatCard icon={TrendingUp} label="Total Revenue" value={fmt(data.revenueTotal)} color="text-[#2E7D32]" />
          <StatCard icon={TrendingDown} label="Total Expenses" value={fmt(data.expenseTotal)} color="text-red-700" />
          <StatCard
            icon={BarChart3}
            label="Net Income"
            value={fmt(data.net)}
            color={data.net >= 0 ? "text-[#2E7D32]" : "text-red-700"}
          />
        </div>

        {data.paymentsByMethod.length > 0 && (
          <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5">
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
      </section>

      {/* Leads */}
      <section>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Leads ({leadTotal})
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#0D1F0E] mb-4">By Stage</p>
            <div className="space-y-3">
              {data.leadsByStage.map((r) => (
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
            <p className="text-sm font-semibold text-[#0D1F0E] mb-4">By Source</p>
            <div className="space-y-3">
              {data.leadsBySource.sort((a, b) => b.count - a.count).map((r) => (
                <BarRow key={r._id} label={r._id ?? "Unknown"} value={r.count} max={leadTotal} color="bg-[#00897B]" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enrollments */}
      <section>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Enrollments ({enrollTotal})
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-[#0D1F0E] mb-4">By Status</p>
            <div className="space-y-3">
              {data.enrollmentsByStatus.map((r) => (
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
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Attendance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={BookOpen} label="Sessions Recorded" value={data.attendanceSessions} />
          <StatCard icon={Users} label="Enrollments" value={enrollTotal} />
          <StatCard icon={BarChart3} label="Lead Conversion" value={`${data.leadsByStage.find(r => r._id === "Paid")?.count ?? 0} paid`} sub={`of ${leadTotal} total leads`} />
        </div>
      </section>
    </div>
  );
}
