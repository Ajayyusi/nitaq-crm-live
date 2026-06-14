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
import { Suspense } from "react";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import Enrollment from "@/models/Enrollment";
import FollowUp from "@/models/FollowUp";
import { Payment } from "@/models/Financial";
import AttendanceSession from "@/models/Attendance";
import { auth } from "@/auth";
import UrlDateFilter from "@/components/shared/UrlDateFilter";
import { buildDateFilter, describeRange, thisMonthRange } from "@/lib/dateRange";

// ── Role helpers ─────────────────────────────────────────────────────────────
const FINANCE_ROLES = new Set(["admin", "manager", "finance"]);
const SALES_ROLES   = new Set(["admin", "manager", "sales"]);
const CLASS_ROLES   = new Set(["admin", "manager", "trainer"]);
const ALL_ROLES     = new Set(["admin", "manager", "sales", "finance", "trainer"]);

function can(role: string, set: Set<string>) { return set.has(role); }

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

// ── Data fetcher — only runs queries the role needs ──────────────────────────
async function getDashboardData(role: string, from: string, to: string, userName = "") {
  try {
    await connectDB();

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const showFinance = can(role, FINANCE_ROLES);
    const showSales   = can(role, SALES_ROLES);
    const showClasses = can(role, CLASS_ROLES);
    const isSalesOnly = role === "sales";

    const dateFilter = buildDateFilter(from || undefined, to || undefined);

    // For sales-only role: filter all queries to their own leads/follow-ups
    const salesFilter = isSalesOnly && userName
      ? { $or: [{ assignedTo: new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }, { createdBy: new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] }
      : {};
    const fuSalesFilter = isSalesOnly && userName
      ? { $or: [{ assignedTo: new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }, { createdBy: new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] }
      : {};

    // Always fetched (admin/manager/finance — not sales-only)
    const activeStudents = isSalesOnly ? 0 : await Enrollment.countDocuments({ status: "Active" });

    // Sales / leads data
    let leadTotal = 0, fresh = 0, interested = 0, enrolled = 0, paid = 0, lost = 0;
    let overdueFollowUps = 0;
    let todayFollowUps: { id: string; contactName: string; phone: string; course: string; type: string; assignedTo: string }[] = [];
    let recentEnrollments: { id: string; enrollmentId: string; fullName: string; course: string; status: string; paymentStatus: string; amountPaid: number; totalFee: number }[] = [];
    let pendingEnrollmentRequests = 0;
    let myPendingRequests = 0;

    let leadsNoFollowUp = 0;
    if (showSales) {
      [leadTotal, fresh, interested, enrolled, paid, lost, overdueFollowUps, leadsNoFollowUp] = await Promise.all([
        Lead.countDocuments(salesFilter),
        Lead.countDocuments({ ...salesFilter, stage: "Lead" }),
        Lead.countDocuments({ ...salesFilter, stage: "Interested" }),
        Lead.countDocuments({ ...salesFilter, stage: "Enrolled" }),
        Lead.countDocuments({ ...salesFilter, stage: "Paid" }),
        Lead.countDocuments({ ...salesFilter, stage: "Lost" }),
        Lead.countDocuments({ ...salesFilter, nextFollowUpDate: { $lt: todayStart }, stage: { $nin: ["Paid", "Lost"] } }),
        Lead.countDocuments({ ...salesFilter, nextFollowUpDate: { $exists: false }, stage: { $nin: ["Enrolled", "Paid", "Lost"] } }),
      ]);
      const rawFollowUps = await FollowUp.find({ ...fuSalesFilter, followUpDate: { $gte: todayStart, $lt: todayEnd }, status: "Pending" })
        .sort({ followUpDate: 1 }).limit(8).lean();
      todayFollowUps = rawFollowUps.map((f) => ({
        id: String(f._id), contactName: f.contactName, phone: f.phone,
        course: f.course ?? "", type: f.type, assignedTo: f.assignedTo ?? "",
      }));
    }

    // Enrollments list — finance only now (sales uses enrollment-request workflow)
    if (showFinance) {
      const raw = await Enrollment.find().sort({ createdAt: -1 }).limit(6).lean();
      recentEnrollments = raw.map((e) => ({
        id: String(e._id), enrollmentId: e.enrollmentId,
        fullName: e.fullName, course: e.course, status: e.status,
        paymentStatus: e.paymentStatus, amountPaid: e.amountPaid, totalFee: e.totalFee,
      }));
    }

    // Enrollment requests — admin/manager see all pending; sales sees their own
    // Import EnrollmentRequest dynamically to avoid top-level import issues
    try {
      const EnrollmentRequest = (await import("@/models/EnrollmentRequest")).default;
      if (!isSalesOnly) {
        pendingEnrollmentRequests = await EnrollmentRequest.countDocuments({ status: "Pending" });
      } else {
        myPendingRequests = await EnrollmentRequest.countDocuments({ salesEmail: userName, status: "Pending" });
      }
    } catch { /* model not yet registered */ }

    // Finance / payments data
    let monthlyRevenue = 0, pendingPayments = 0;
    let recentPayments: { id: string; studentName: string; course: string; amount: number; datePaid: string }[] = [];

    if (showFinance) {
      [monthlyRevenue, pendingPayments] = await Promise.all([
        Payment.aggregate([
          {
            $match: {
              status: "Received",
              ...(dateFilter ? { datePaid: dateFilter } : {}),
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).then((r) => r[0]?.total ?? 0),
        Payment.aggregate([
          { $match: { status: { $in: ["Pending", "Overdue"] } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).then((r) => r[0]?.total ?? 0),
      ]);
      const raw = await Payment.find({ status: "Received" }).sort({ datePaid: -1 }).limit(4).lean();
      recentPayments = raw.map((p) => ({
        id: String(p._id), studentName: p.studentName, course: p.course ?? "",
        amount: p.amount, datePaid: p.datePaid ? new Date(p.datePaid).toLocaleDateString("en-AE") : "",
      }));
    }

    // Classes / sessions data
    let upcomingSessions = 0;
    if (showClasses) {
      upcomingSessions = await AttendanceSession.countDocuments({ sessionDate: { $gte: todayStart } });
    }

    // Course breakdown — admin/manager/finance only
    let courseBreakdown: { course: string; count: number; revenue: number }[] = [];
    if (!isSalesOnly) {
      const courseBreakdownRaw = await Enrollment.aggregate([
        { $match: { status: "Active" } },
        { $group: { _id: "$course", count: { $sum: 1 }, revenue: { $sum: "$amountPaid" } } },
        { $sort: { count: -1 } }, { $limit: 6 },
      ]);
      courseBreakdown = courseBreakdownRaw.map((c) => ({
        course: c._id as string, count: c.count as number, revenue: c.revenue as number,
      }));
    }

    const conversionRate = leadTotal > 0 ? Math.round((paid / leadTotal) * 100) : 0;

    return {
      role, showFinance, showSales, showClasses, isSalesOnly,
      leadTotal, fresh, interested, enrolled, paid, lost, leadsNoFollowUp,
      activeStudents, monthlyRevenue, pendingPayments, overdueFollowUps,
      upcomingSessions, conversionRate, pendingEnrollmentRequests, myPendingRequests,
      todayFollowUps, recentEnrollments, courseBreakdown, recentPayments,
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

const statusColor: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Completed: "bg-teal-100 text-teal-700",
  Dropped: "bg-rose-100 text-rose-700",
  "On Hold": "bg-amber-100 text-amber-700",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  const rawRole = (session?.user as { role?: string })?.role ?? "sales";
  const role = rawRole === "staff" ? "sales" : rawRole;

  const { from: rawFrom, to: rawTo } = await searchParams;
  const defaultRange = thisMonthRange();
  // If URL has no params, default to this month; if params present (even empty), use them
  const from = rawFrom !== undefined ? rawFrom : defaultRange.from;
  const to   = rawTo   !== undefined ? rawTo   : defaultRange.to;
  const userName = session?.user?.name ?? "";

  const data = await getDashboardData(role, from, to, userName);

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

  const now       = new Date(data.now);
  const hour      = now.getHours();
  const greet     = greeting(hour);
  const firstName = (session?.user?.name ?? "").split(" ")[0] || "there";
  const dateStr   = formatDate(now);
  const periodLabel = describeRange(from, to);

  // ── KPIs — assembled per role ─────────────────────────────────────────────
  const kpis = [
    // Sales/leads KPIs
    data.showSales && {
      label: data.isSalesOnly ? "My Leads" : "Total Leads",
      value: data.leadTotal,
      sub: data.isSalesOnly ? "Assigned to me" : "All enquiries",
      icon: UserPlus, topColor: "#2196F3", href: "/leads",
    },
    // Active students — admin/manager/finance only
    !data.isSalesOnly && {
      label: "Active Students", value: data.activeStudents,
      sub: "Currently enrolled", icon: UsersRound, topColor: "#2E7D32", href: "/students",
    },
    // Finance KPI
    data.showFinance && {
      label: `Revenue (${periodLabel})`, value: fmt(data.monthlyRevenue),
      sub: "Received payments", icon: CircleDollarSign, topColor: "#7B1FA2", href: "/finance",
    },
    // Sales KPI
    data.showSales && {
      label: "Follow-Ups Today", value: data.todayFollowUps.length,
      sub: data.overdueFollowUps > 0 ? `${data.overdueFollowUps} overdue` : "Scheduled",
      icon: BellRing, topColor: data.overdueFollowUps > 0 ? "#EF5350" : "#F59E0B", href: "/follow-ups",
    },
    // Finance KPI
    data.showFinance && {
      label: "Pending Payments", value: fmt(data.pendingPayments),
      sub: "Awaiting collection", icon: HandCoins,
      topColor: data.pendingPayments > 0 ? "#EF5350" : "#78909C", href: "/payments",
    },
    // Sales KPI — conversion
    data.showSales && {
      label: data.isSalesOnly ? "My Paid / Converted" : "Paid / Converted",
      value: data.paid,
      sub: `${data.conversionRate}% conversion rate`, icon: CheckCircle2, topColor: "#00897B", href: "/leads",
    },
    // Classes KPI
    data.showClasses && {
      label: "Upcoming Sessions", value: data.upcomingSessions,
      sub: "From today", icon: CalendarDays, topColor: "#F57C00", href: "/classes",
    },
    // Finance KPI
    data.showFinance && {
      label: "Certificate Due",
      value: data.recentEnrollments.filter((e) => e.status === "Completed" && e.amountPaid >= e.totalFee).length,
      sub: "Completed & paid", icon: Award, topColor: "#C62828", href: "/students",
    },
    // Admin/Manager — pending enrollment requests
    !data.isSalesOnly && data.showSales && data.pendingEnrollmentRequests > 0 && {
      label: "Enrollment Requests", value: data.pendingEnrollmentRequests,
      sub: "Pending review", icon: GraduationCap, topColor: "#F57C00", href: "/enrollment-requests",
    },
    // Sales only — their pending enrollment requests
    data.isSalesOnly && data.myPendingRequests > 0 && {
      label: "My Enrollment Requests", value: data.myPendingRequests,
      sub: "Awaiting admin review", icon: GraduationCap, topColor: "#F57C00", href: "/enrollment-requests",
    },
    // Sales only — overdue follow-ups as separate KPI
    data.showSales && data.overdueFollowUps > 0 && {
      label: "Overdue Follow-Ups", value: data.overdueFollowUps,
      sub: "Need immediate action", icon: BellRing, topColor: "#EF5350", href: "/follow-ups",
    },
    // Sales — leads with no follow-up scheduled
    data.showSales && data.leadsNoFollowUp > 0 && {
      label: "No Follow-Up Set", value: data.leadsNoFollowUp,
      sub: "Active leads not scheduled", icon: UserPlus, topColor: "#78909C", href: "/leads",
    },
  ].filter(Boolean) as { label: string; value: number | string; sub: string; icon: typeof UserPlus; topColor: string; href: string }[];

  return (
    <div className="space-y-7">
      {/* ── Greeting hero ─────────────────────────────────────────────────── */}
      <section
        className="overflow-hidden rounded-2xl shadow-xl"
        style={{ background: "linear-gradient(135deg, #0D1F0E 0%, #1B5E20 60%, #2E7D32 100%)" }}
      >
        <div className="relative px-8 py-8">
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
              <h1 className="mt-1 text-2xl font-bold text-white xl:text-3xl">Nitaq Academy CRM</h1>
              <p className="mt-1.5 text-sm text-green-200">{dateStr} · Sharjah, UAE</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {/* Sales actions */}
                {data.showSales && (
                  <>
                    <Link href="/leads" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#1B5E20] shadow-lg transition hover:bg-green-50">
                      <Plus className="h-4 w-4" /> Add Lead
                    </Link>
                    <Link href="/follow-ups" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20">
                      <BellRing className="h-4 w-4" /> Follow-Ups
                      {data.overdueFollowUps > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">{data.overdueFollowUps}</span>
                      )}
                    </Link>
                    {!data.isSalesOnly && (
                      <Link href="/enrollments" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20">
                        <GraduationCap className="h-4 w-4" /> Enroll
                      </Link>
                    )}
                    {data.isSalesOnly && (
                      <Link href="/enrollment-requests" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20">
                        <GraduationCap className="h-4 w-4" /> My Requests
                        {data.myPendingRequests > 0 && (
                          <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">{data.myPendingRequests}</span>
                        )}
                      </Link>
                    )}
                  </>
                )}
                {/* Finance actions */}
                {data.showFinance && !data.showSales && (
                  <>
                    <Link href="/payments" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#1B5E20] shadow-lg transition hover:bg-green-50">
                      <CircleDollarSign className="h-4 w-4" /> Record Payment
                    </Link>
                    <Link href="/expenses" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20">
                      <HandCoins className="h-4 w-4" /> Add Expense
                    </Link>
                    <Link href="/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20">
                      <BarChart3 className="h-4 w-4" /> Reports
                    </Link>
                  </>
                )}
                {/* Trainer actions */}
                {role === "trainer" && (
                  <>
                    <Link href="/classes" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#1B5E20] shadow-lg transition hover:bg-green-50">
                      <CalendarDays className="h-4 w-4" /> My Classes
                    </Link>
                    <Link href="/courses" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20">
                      <BookOpen className="h-4 w-4" /> Courses
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Live snapshot — finance only */}
            {data.showFinance && (
              <div className="hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5 lg:block" style={{ minWidth: 200 }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-300">Live snapshot</p>
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-green-200">Students</span>
                    <span className="font-bold text-white">{data.activeStudents}</span>
                  </div>
                  <div className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-green-200">{periodLabel}</span>
                    <span className="font-bold text-white">{fmt(data.monthlyRevenue)}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-green-200">Pending</span>
                    <span className="font-bold text-amber-300">{fmt(data.pendingPayments)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Live snapshot — manager (no AED) */}
            {data.showSales && !data.showFinance && !data.isSalesOnly && (
              <div className="hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5 lg:block" style={{ minWidth: 200 }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-300">Live snapshot</p>
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-green-200">Leads</span>
                    <span className="font-bold text-white">{data.leadTotal}</span>
                  </div>
                  <div className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-green-200">Interested</span>
                    <span className="font-bold text-white">{data.interested}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between gap-8 text-sm">
                    <span className="text-green-200">Follow-ups today</span>
                    <span className={`font-bold ${data.overdueFollowUps > 0 ? "text-amber-300" : "text-white"}`}>
                      {data.todayFollowUps.length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Period filter (finance-relevant roles) ──────────────────────── */}
      {data.showFinance && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="font-medium">Period:</span>
          <Suspense fallback={null}>
            <UrlDateFilter defaultFrom={defaultRange.from} defaultTo={defaultRange.to} />
          </Suspense>
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ background: kpi.topColor }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
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

      {/* ── Pipeline + Follow-ups (Sales / Admin / Manager only) ─────────── */}
      {data.showSales && (
        <section className="grid gap-5 xl:grid-cols-2">
          {/* Pipeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0D1F0E]">Admissions Pipeline</h2>
                <p className="mt-0.5 text-xs text-slate-500">Lead-to-paid conversion funnel</p>
              </div>
              <Link href="/leads" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]">
                All Leads
              </Link>
            </div>
            <div className="mt-5 flex items-center gap-1 overflow-x-auto pb-1">
              {[
                { label: "Lead", value: data.fresh, color: "#2196F3" },
                { label: "Interested", value: data.interested, color: "#F59E0B" },
                { label: "Enrolled", value: data.enrolled, color: "#2E7D32" },
                { label: "Paid", value: data.paid, color: "#00897B" },
              ].map((stage, i) => (
                <div key={stage.label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="rounded-xl px-4 py-3 text-center shadow-sm" style={{ background: stage.color + "14", border: `1px solid ${stage.color}30` }}>
                      <p className="text-2xl font-bold" style={{ color: stage.color }}>{stage.value}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{stage.label}</p>
                    </div>
                  </div>
                  {i < 3 && <ArrowRight className="mx-1 h-4 w-4 flex-shrink-0 text-slate-300" />}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="text-sm font-semibold text-rose-700">Lost / Dropped out</span>
              </div>
              <span className="text-lg font-bold text-rose-700">{data.lost}</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Lead", value: data.fresh, color: "#2196F3" },
                { label: "Interested", value: data.interested, color: "#F59E0B" },
                { label: "Enrolled", value: data.enrolled, color: "#2E7D32" },
                { label: "Paid", value: data.paid, color: "#00897B" },
              ].map((item) => {
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
                      <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: item.color }} />
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
              <Link href="/follow-ups" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]">
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
                    <div key={f.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-[#2E7D32]/30 hover:bg-[#E8F5E9]">
                      <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[#E8F5E9]">
                        <Icon className="h-4 w-4 text-[#2E7D32]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0D1F0E]">{f.contactName}</p>
                        {f.course && <p className="truncate text-xs text-slate-500">{f.course}</p>}
                        <p className="mt-0.5 text-[11px] text-slate-400">{f.type}</p>
                      </div>
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 rounded-lg bg-green-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-green-600">
                        WA
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Trainer view — classes / sessions ───────────────────────────── */}
      {role === "trainer" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100">
              <CalendarDays className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Your Sessions</h2>
              <p className="text-xs text-slate-500">{data.upcomingSessions} upcoming from today</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link href="/classes" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]">
              <CalendarDays className="h-4 w-4" /> View Classes
            </Link>
            <Link href="/courses" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]">
              <BookOpen className="h-4 w-4" /> Course Reference
            </Link>
          </div>
        </section>
      )}

      {/* ── Course Breakdown + Enrollments / Payments ────────────────────── */}
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Recent enrollments — shown to admin/manager/finance only (not sales-only) */}
        {(data.showFinance || (data.showSales && !data.isSalesOnly)) && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0D1F0E]">Recent Enrollments</h2>
                <p className="mt-0.5 text-xs text-slate-500">Latest 6 student registrations</p>
              </div>
              <Link href="/enrollments" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]">
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
                    {data.showFinance && (
                      <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid</th>
                    )}
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
                      {data.showFinance && (
                        <td className="px-6 py-3.5 text-right">
                          <p className="text-sm font-bold text-[#0D1F0E]">AED {e.amountPaid.toLocaleString()}</p>
                          {e.amountPaid < e.totalFee && (
                            <p className="text-[11px] text-slate-400">of {e.totalFee.toLocaleString()}</p>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {data.recentEnrollments.length === 0 && (
                    <tr>
                      <td colSpan={data.showFinance ? 4 : 3} className="px-6 py-10 text-center text-sm text-slate-400">
                        No enrollments yet.{" "}
                        <Link href="/enrollments" className="font-bold text-[#2E7D32]">Add one →</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Course breakdown + recent payments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0D1F0E]">Active by Course</h2>
              <p className="mt-0.5 text-xs text-slate-500">Students currently enrolled</p>
            </div>
            <Link href="/courses" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0D1F0E] transition hover:border-[#2E7D32] hover:bg-[#E8F5E9]">
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
                        {data.showFinance && <span className="text-xs text-slate-400">{fmt(c.revenue)}</span>}
                        <span className="font-bold text-[#0D1F0E]">{c.count}</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent payments — finance only */}
          {data.showFinance && data.recentPayments.length > 0 && (
            <>
              <div className="mt-6 mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Payments</p>
                <Link href="/payments" className="text-xs font-bold text-[#2E7D32] hover:underline">View all</Link>
              </div>
              <div className="space-y-2">
                {data.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0D1F0E]">{p.studentName}</p>
                      <p className="text-[11px] text-slate-400">{p.datePaid}</p>
                    </div>
                    <span className="ml-3 flex-shrink-0 text-sm font-bold text-[#2E7D32]">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Quick actions — filtered by role ─────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#0D1F0E]">Quick Actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {data.showSales && (
            <>
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
            </>
          )}
          {data.showFinance && (
            <>
              <Link href="/payments" className="flex flex-col items-center gap-2.5 rounded-xl border border-purple-100 bg-purple-50 px-4 py-4 text-center text-sm font-bold text-purple-800 transition hover:border-purple-300 hover:bg-purple-100">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-600"><CircleDollarSign className="h-5 w-5" /></div>
                Record Payment
              </Link>
              <Link href="/reports" className="flex flex-col items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-4 text-center text-sm font-bold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 text-teal-600"><TrendingUp className="h-5 w-5" /></div>
                Reports
              </Link>
            </>
          )}
          {data.showClasses && (
            <Link href="/classes" className="flex flex-col items-center gap-2.5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-4 text-center text-sm font-bold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-600"><CalendarDays className="h-5 w-5" /></div>
              Attendance
            </Link>
          )}
          {can(role, new Set(["admin", "manager", "sales", "finance"])) && (
            <Link href="/import-export" className="flex flex-col items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-600"><ArrowUpDown className="h-5 w-5" /></div>
              Import / Export
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
