import Link from "next/link";
import {
  ArrowRight,
  ArrowUpDown,
  Award,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  GraduationCap,
  HandCoins,
  MessageSquare,
  Phone,
  Plus,
  TrendingUp,
  UserPlus,
  UsersRound,
} from "lucide-react";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import Enrollment from "@/models/Enrollment";
import FollowUp from "@/models/FollowUp";
import { Payment } from "@/models/Financial";
import AttendanceSession from "@/models/Attendance";
import { auth } from "@/auth";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

async function getDashboardData() {
  try {
    await connectDB();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      leadTotal, fresh, interested, enrolled, paid, lost,
      activeStudents,
      monthlyRevenue,
      pendingPayments,
      overdueFollowUps,
      upcomingSessions,
      todayFollowUpsRaw,
      recentEnrollmentsRaw,
      courseBreakdownRaw,
      recentPaymentsRaw,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ stage: "Lead" }),
      Lead.countDocuments({ stage: "Interested" }),
      Lead.countDocuments({ stage: "Enrolled" }),
      Lead.countDocuments({ stage: "Paid" }),
      Lead.countDocuments({ stage: "Lost" }),
      Enrollment.countDocuments({ status: "Active" }),
      Payment.aggregate([
        { $match: { status: "Received", datePaid: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Payment.aggregate([
        { $match: { status: { $in: ["Pending", "Overdue"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((r) => r[0]?.total ?? 0),
      Lead.countDocuments({ nextFollowUpDate: { $lt: todayStart }, stage: { $nin: ["Paid", "Lost"] } }),
      AttendanceSession.countDocuments({ sessionDate: { $gte: todayStart } }),
      FollowUp.find({ followUpDate: { $gte: todayStart, $lt: todayEnd }, status: "Pending" })
        .sort({ followUpDate: 1 })
        .limit(8)
        .lean(),
      Enrollment.find().sort({ createdAt: -1 }).limit(6).lean(),
      Enrollment.aggregate([
        { $match: { status: "Active" } },
        { $group: { _id: "$course", count: { $sum: 1 }, revenue: { $sum: "$amountPaid" } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      Payment.find({ status: "Received" }).sort({ datePaid: -1 }).limit(4).lean(),
    ]);

    const conversionRate = leadTotal > 0 ? Math.round((paid / leadTotal) * 100) : 0;

    return {
      leadTotal, fresh, interested, enrolled, paid, lost,
      activeStudents, monthlyRevenue, pendingPayments, overdueFollowUps,
      upcomingSessions, conversionRate,
      todayFollowUps: todayFollowUpsRaw.map((f) => ({
        id: String(f._id),
        contactName: f.contactName,
        phone: f.phone,
        course: f.course ?? "",
        type: f.type,
        assignedTo: f.assignedTo ?? "",
      })),
      recentEnrollments: recentEnrollmentsRaw.map((e) => ({
        id: String(e._id),
        enrollmentId: e.enrollmentId,
        fullName: e.fullName,
        course: e.course,
        status: e.status,
        paymentStatus: e.paymentStatus,
        amountPaid: e.amountPaid,
        totalFee: e.totalFee,
      })),
      courseBreakdown: courseBreakdownRaw.map((c) => ({
        course: c._id as string,
        count: c.count as number,
        revenue: c.revenue as number,
      })),
      recentPayments: recentPaymentsRaw.map((p) => ({
        id: String(p._id),
        studentName: p.studentName,
        course: p.course,
        amount: p.amount,
        datePaid: p.datePaid ? new Date(p.datePaid).toLocaleDateString("en-AE") : "",
      })),
      connected: true,
      now: now.toISOString(),
    };
  } catch {
    return null;
  }
}

const followUpTypeIcon: Record<string, typeof Phone> = {
  "Phone Call": Phone,
  "WhatsApp Message": MessageSquare,
  "Send Brochure": BookOpen,
  "Send Pricing": CircleDollarSign,
  "In-Person": CalendarCheck,
  Email: BarChart3,
  Other: BellRing,
};

export default async function DashboardPage() {
  const [data, session] = await Promise.all([getDashboardData(), auth()]);

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="font-bold text-rose-700">Could not connect to database.</p>
          <p className="mt-1 text-sm text-rose-600">Check your MONGODB_URI in .env.local</p>
        </div>
      </div>
    );
  }

  const now = new Date(data.now);
  const hour = now.getHours();
  const greet = greeting(hour);
  const firstName = (session?.user?.name ?? "").split(" ")[0] || "there";
  const dateStr = formatDate(now);

  const kpis = [
    { label: "Total Leads", value: data.leadTotal, sub: "All enquiries", icon: UserPlus, topColor: "#2196F3", href: "/leads" },
    { label: "Active Students", value: data.activeStudents, sub: "Currently enrolled", icon: UsersRound, topColor: "#2E7D32", href: "/students" },
    { label: "Monthly Revenue", value: fmt(data.monthlyRevenue), sub: "Received this month", icon: CircleDollarSign, topColor: "#7B1FA2", href: "/finance" },
    { label: "Follow-Ups Today", value: data.todayFollowUps.length, sub: data.overdueFollowUps > 0 ? `${data.overdueFollowUps} overdue` : "Scheduled", icon: BellRing, topColor: data.overdueFollowUps > 0 ? "#EF5350" : "#F59E0B", href: "/follow-ups" },
    { label: "Pending Payments", value: fmt(data.pendingPayments), sub: "Awaiting collection", icon: HandCoins, topColor: data.pendingPayments > 0 ? "#EF5350" : "#78909C", href: "/payments" },
    { label: "Paid / Converted", value: data.paid, sub: `${data.conversionRate}% conversion rate`, icon: CheckCircle2, topColor: "#00897B", href: "/leads" },
    { label: "Upcoming Sessions", value: data.upcomingSessions, sub: "From today", icon: CalendarDays, topColor: "#F57C00", href: "/classes" },
    { label: "Certificate Due", value: data.recentEnrollments.filter(e => e.status === "Completed" && e.amountPaid >= e.totalFee).length, sub: "Completed & paid", icon: Award, topColor: "#C62828", href: "/students" },
  ];

  const pipeline = [
    { label: "Lead", value: data.fresh, color: "#2196F3", bg: "bg-blue-50 text-blue-700" },
    { label: "Interested", value: data.interested, color: "#F59E0B", bg: "bg-amber-50 text-amber-700" },
    { label: "Enrolled", value: data.enrolled, color: "#2E7D32", bg: "bg-green-50 text-green-700" },
    { label: "Paid", value: data.paid, color: "#00897B", bg: "bg-teal-50 text-teal-700" },
    { label: "Lost", value: data.lost, color: "#EF5350", bg: "bg-rose-50 text-rose-700" },
  ];

  const statusColor: Record<string, string> = {
    Active: "bg-green-100 text-green-700",
    Completed: "bg-teal-100 text-teal-700",
    Dropped: "bg-rose-100 text-rose-700",
    "On Hold": "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-7">
      {/* Greeting hero */}
      <section
        className="overflow-hidden rounded-2xl shadow-xl"
        style={{ background: "linear-gradient(135deg, #0D1F0E 0%, #1B5E20 60%, #2E7D32 100%)" }}
      >
        <div className="relative px-8 py-8">
          {/* decorative grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-green-300">{greet}, {firstName} 👋</p>
              <h1 className="mt-1 text-2xl font-bold text-white xl:text-3xl">
                Nitaq Academy CRM
              </h1>
              <p className="mt-1.5 text-sm text-green-200">{dateStr} · Sharjah, UAE</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/leads"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#1B5E20] shadow-lg transition hover:bg-green-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Lead
                </Link>
                <Link
                  href="/follow-ups"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  <BellRing className="h-4 w-4" />
                  Follow-Ups
                  {data.overdueFollowUps > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">
                      {data.overdueFollowUps}
                    </span>
                  )}
                </Link>
                <Link
                  href="/enrollments"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  <GraduationCap className="h-4 w-4" />
                  Enroll
                </Link>
              </div>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5 lg:block" style={{ minWidth: 200 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-300">Live snapshot</p>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-8 text-sm">
                  <span className="text-green-200">Leads</span>
                  <span className="font-bold text-white">{data.leadTotal}</span>
                </div>
                <div className="flex items-center justify-between gap-8 text-sm">
                  <span className="text-green-200">Students</span>
                  <span className="font-bold text-white">{data.activeStudents}</span>
                </div>
                <div className="flex items-center justify-between gap-8 text-sm">
                  <span className="text-green-200">This month</span>
                  <span className="font-bold text-white">{fmt(data.monthlyRevenue)}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between gap-8 text-sm">
                  <span className="text-green-200">Pending</span>
                  <span className="font-bold text-amber-300">{fmt(data.pendingPayments)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8 KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
                style={{ background: kpi.topColor }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-2.5 text-3xl font-bold tracking-tight text-[#0D1F0E]">
                    {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                  </p>
                </div>
                <div
                  className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl"
                  style={{ background: kpi.topColor + "18", color: kpi.topColor }}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{kpi.sub}</p>
            </Link>
          );
        })}
      </section>

      {/* Pipeline + Follow-ups */}
      <section className="grid gap-5 xl:grid-cols-2">
        {/* Pipeline with arrows */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Admissions Pipeline</h2>
              <p className="mt-0.5 text-xs text-slate-500">Lead-to-paid conversion funnel</p>
            </div>
            <Link
              href="/leads"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              All Leads
            </Link>
          </div>

          {/* Arrow pipeline */}
          <div className="mt-5 flex items-center gap-1 overflow-x-auto pb-1">
            {pipeline.slice(0, 4).map((stage, i) => (
              <div key={stage.label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className="rounded-xl px-4 py-3 text-center shadow-sm"
                    style={{ background: stage.color + "14", border: `1px solid ${stage.color}30` }}
                  >
                    <p className="text-2xl font-bold" style={{ color: stage.color }}>
                      {stage.value}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{stage.label}</p>
                  </div>
                </div>
                {i < 3 && (
                  <ArrowRight className="mx-1 h-4 w-4 flex-shrink-0 text-slate-300" />
                )}
              </div>
            ))}
          </div>

          {/* Lost row */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-sm font-semibold text-rose-700">Lost / Dropped out</span>
            </div>
            <span className="text-lg font-bold text-rose-700">{data.lost}</span>
          </div>

          {/* Bar visualization */}
          <div className="mt-5 space-y-3">
            {pipeline.slice(0, 4).map((item) => {
              const width = data.leadTotal > 0 ? Math.max(4, Math.round((item.value / data.leadTotal) * 100)) : 4;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">{item.label}</span>
                    <span className="font-bold text-slate-800">
                      {data.leadTotal > 0 ? Math.round((item.value / data.leadTotal) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${width}%`, background: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's follow-ups */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Today&apos;s Follow-Ups</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {data.todayFollowUps.length} pending today
                {data.overdueFollowUps > 0 && ` · ${data.overdueFollowUps} overdue`}
              </p>
            </div>
            <Link
              href="/follow-ups"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              All Follow-Ups
            </Link>
          </div>

          {data.todayFollowUps.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl bg-slate-50 py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">No follow-ups due today</p>
              <p className="mt-1 text-xs text-slate-400">Check back tomorrow</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {data.todayFollowUps.map((f) => {
                const Icon = followUpTypeIcon[f.type] ?? BellRing;
                const waLink = `https://wa.me/${f.phone.replace(/\D/g, "")}`;
                return (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-[#2E7D32]/30 hover:bg-[#E8F5E9]"
                  >
                    <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[#E8F5E9]">
                      <Icon className="h-4 w-4 text-[#2E7D32]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0D1F0E]">{f.contactName}</p>
                      {f.course && (
                        <p className="truncate text-xs text-slate-500">{f.course}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-400">{f.type}</p>
                    </div>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 rounded-lg bg-green-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-green-600"
                    >
                      WA
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Course Breakdown + Recent Enrollments */}
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Recent enrollments table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Recent Enrollments</h2>
              <p className="mt-0.5 text-xs text-slate-500">Latest 6 student registrations</p>
            </div>
            <Link
              href="/enrollments"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              All Enrollments
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Student</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Course</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentEnrollments.map((e) => (
                  <tr key={e.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-semibold text-[#0D1F0E]">{e.fullName}</p>
                      <p className="text-[11px] text-slate-400">{e.enrollmentId}</p>
                    </td>
                    <td className="max-w-[160px] px-4 py-3.5">
                      <p className="truncate text-sm text-slate-700">{e.course}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusColor[e.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <p className="text-sm font-bold text-[#0D1F0E]">
                        AED {e.amountPaid.toLocaleString()}
                      </p>
                      {e.amountPaid < e.totalFee && (
                        <p className="text-[11px] text-slate-400">of {e.totalFee.toLocaleString()}</p>
                      )}
                    </td>
                  </tr>
                ))}
                {data.recentEnrollments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">
                      No enrollments yet.{" "}
                      <Link href="/enrollments" className="font-bold text-[#2E7D32]">
                        Add one →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Course breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Active by Course</h2>
              <p className="mt-0.5 text-xs text-slate-500">Students currently enrolled</p>
            </div>
            <Link
              href="/courses"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              Courses
            </Link>
          </div>

          {data.courseBreakdown.length === 0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 py-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">No active enrollments yet.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {data.courseBreakdown.map((c, idx) => {
                const maxCount = Math.max(...data.courseBreakdown.map((x) => x.count));
                const width = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0;
                const colors = ["#2E7D32", "#00897B", "#2196F3", "#7B1FA2", "#F57C00", "#C62828"];
                const color = colors[idx % colors.length];
                return (
                  <div key={c.course}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-slate-700">{c.course}</span>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className="text-xs text-slate-400">{fmt(c.revenue)}</span>
                        <span className="font-bold text-[#0D1F0E]">{c.count}</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent payments mini list */}
          {data.recentPayments.length > 0 && (
            <>
              <div className="mt-6 mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Payments</p>
                <Link href="/payments" className="text-xs font-bold text-[#2E7D32] hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {data.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0D1F0E]">{p.studentName}</p>
                      <p className="text-[11px] text-slate-400">{p.datePaid}</p>
                    </div>
                    <span className="ml-3 flex-shrink-0 text-sm font-bold text-[#2E7D32]">
                      {fmt(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#0D1F0E]">Quick Actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <Link href="/leads" className="flex flex-col items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-center text-sm font-bold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-600"><UserPlus className="h-5 w-5" /></div>
            Add Lead
          </Link>
          <Link href="/follow-ups" className="flex flex-col items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-4 text-center text-sm font-bold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600"><BellRing className="h-5 w-5" /></div>
            Follow-Ups
          </Link>
          <Link href="/enrollments" className="flex flex-col items-center gap-2.5 rounded-xl border border-green-100 bg-green-50 px-4 py-4 text-center text-sm font-bold text-green-800 transition hover:border-green-300 hover:bg-green-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-100 text-green-700"><GraduationCap className="h-5 w-5" /></div>
            Enroll Student
          </Link>
          <Link href="/payments" className="flex flex-col items-center gap-2.5 rounded-xl border border-purple-100 bg-purple-50 px-4 py-4 text-center text-sm font-bold text-purple-800 transition hover:border-purple-300 hover:bg-purple-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-600"><CircleDollarSign className="h-5 w-5" /></div>
            Record Payment
          </Link>
          <Link href="/classes" className="flex flex-col items-center gap-2.5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-4 text-center text-sm font-bold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-600"><CalendarDays className="h-5 w-5" /></div>
            Attendance
          </Link>
          <Link href="/reports" className="flex flex-col items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-4 text-center text-sm font-bold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 text-teal-600"><TrendingUp className="h-5 w-5" /></div>
            Reports
          </Link>
          <Link href="/import-export" className="flex flex-col items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-600"><ArrowUpDown className="h-5 w-5" /></div>
            Import / Export
          </Link>
        </div>
      </section>
    </div>
  );
}
