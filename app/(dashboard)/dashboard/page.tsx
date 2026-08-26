import Link from "next/link";
import {
  ArrowUpDown,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CircleDollarSign,
  GraduationCap,
  HandCoins,
  MessageSquare,
  Phone,
  Plus,
} from "lucide-react";
import { Suspense } from "react";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import FollowUp from "@/models/FollowUp";
import { Payment } from "@/models/Financial";
import AttendanceSession from "@/models/Attendance";
import { auth } from "@/auth";
import UrlDateFilter from "@/components/shared/UrlDateFilter";
import { buildDateFilter, describeRange, thisMonthRange } from "@/lib/dateRange";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Instrument } from "@/components/ui/instrument";
import { Lamp } from "@/components/ui/lamp";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const solidAction = cn(buttonVariants({ variant: "solid" }));
const quietAction = cn(
  buttonVariants({ variant: "ghost" }),
  "border border-bezel-strong text-dim hover:border-phos hover:bg-transparent hover:text-phos"
);

/**
 * Stages where a lead is no longer chased. Converting a lead clears its
 * follow-up date (see app/api/leads/[id]), but historic records may still
 * carry one — excluding these stages keeps enrolled students out of the
 * overdue count either way.
 */
const CLOSED_LEAD_STAGES = ["Enrolled", "Paid", "Lost", "Not Interested", "Invalid Number"];

// ── Role helpers ─────────────────────────────────────────────────────────────
const FINANCE_ROLES = new Set(["admin", "manager", "finance"]);
const SALES_ROLES   = new Set(["admin", "manager", "sales"]);
const CLASS_ROLES   = new Set(["admin", "manager", "trainer"]);

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
async function getDashboardData(role: string, from: string, to: string, userName = "", userEmail = "") {
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

    // Active students — trainers only ever count THEIR OWN assigned students
    let activeStudents = 0;
    if (role === "trainer") {
      const Teacher = (await import("@/models/Teacher")).default;
      const teacher = userEmail ? await Teacher.findOne({ email: userEmail.toLowerCase() }).select("_id").lean() : null;
      activeStudents = teacher
        ? await Enrollment.countDocuments({ status: "Active", teacherId: teacher._id })
        : 0;
    } else if (!isSalesOnly) {
      activeStudents = await Enrollment.countDocuments({ status: "Active" });
    }

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
        Lead.countDocuments({ ...salesFilter, nextFollowUpDate: { $lt: todayStart }, stage: { $nin: CLOSED_LEAD_STAGES } }),
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
    let certificatesDue = 0;
    if (showFinance) {
      const raw = await Enrollment.find().sort({ createdAt: -1 }).limit(6).lean();
      recentEnrollments = raw.map((e) => ({
        id: String(e._id), enrollmentId: e.enrollmentId,
        fullName: e.fullName, course: e.course, status: e.status,
        paymentStatus: e.paymentStatus, amountPaid: e.amountPaid, totalFee: e.totalFee,
      }));
      // Honest global count (previously computed from the 6 most recent only)
      certificatesDue = await Enrollment.countDocuments({
        status: "Completed",
        $expr: { $gte: ["$amountPaid", "$totalFee"] },
      });
    }

    // Enrollment requests — admin/manager see all pending; sales sees their own
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

    // Sales performance — admin/manager only
    let salesPerformance: { name: string; total: number; interested: number; converted: number; overdue: number; fuDone: number; fuTotal: number }[] = [];
    if (!isSalesOnly && can(role, SALES_ROLES)) {
      const salesStaff = await User.find({ role: { $in: ["sales", "staff"] }, active: true }, { name: 1 }).lean();
      salesPerformance = await Promise.all(
        salesStaff.map(async (u) => {
          const nameRx = new RegExp(`^${u.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
          const ownerFilter = { $or: [{ assignedTo: nameRx }, { createdBy: nameRx }] };
          const fuOwnerFilter = { assignedTo: nameRx };
          const [total, interested, converted, overdue, fuDone, fuTotal] = await Promise.all([
            Lead.countDocuments(ownerFilter),
            Lead.countDocuments({ ...ownerFilter, stage: "Interested" }),
            Lead.countDocuments({ ...ownerFilter, stage: { $in: ["Enrolled", "Paid"] } }),
            Lead.countDocuments({ ...ownerFilter, nextFollowUpDate: { $lt: todayStart }, stage: { $nin: CLOSED_LEAD_STAGES } }),
            FollowUp.countDocuments({ ...fuOwnerFilter, status: "Done" }),
            FollowUp.countDocuments(fuOwnerFilter),
          ]);
          return { name: u.name, total, interested, converted, overdue, fuDone, fuTotal };
        })
      );
      salesPerformance = salesPerformance.filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
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
      certificatesDue,
      todayFollowUps, recentEnrollments, courseBreakdown, recentPayments, salesPerformance,
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

const STAGE_COLORS = ["var(--advisory)", "var(--caution-fill)", "var(--phos)", "var(--phos-bright)"];

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

  const data = await getDashboardData(role, from, to, userName, session?.user?.email ?? "");

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] p-8 text-center">
          <p className="font-bold text-alert">Couldn&apos;t reach the database.</p>
          <p className="mt-1 text-sm text-dim">Try again shortly — if it persists, contact your administrator.</p>
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

  // ── The six-pack: the role's primary instruments, ranked ─────────────────
  const sixPack = [
    data.showSales && {
      label: data.isSalesOnly ? "My Leads" : "Total Leads",
      value: data.leadTotal, sub: data.isSalesOnly ? "Assigned to me" : "All enquiries",
      href: "/leads", tone: "ink" as const,
    },
    !data.isSalesOnly && {
      label: "Active Students", value: data.activeStudents,
      sub: "Currently enrolled", href: "/students", tone: "ink" as const,
    },
    data.showFinance && {
      label: `Revenue · ${periodLabel}`, value: fmt(data.monthlyRevenue),
      sub: "Received payments", href: "/finance", tone: "phos" as const,
    },
    data.showFinance && {
      label: "Pending Collection", value: fmt(data.pendingPayments),
      sub: "Awaiting collection", href: "/collections",
      tone: data.pendingPayments > 0 ? ("caution" as const) : ("ink" as const),
    },
    data.showSales && {
      label: "Follow-Ups Today", value: data.todayFollowUps.length,
      sub: data.overdueFollowUps > 0 ? `${data.overdueFollowUps} overdue` : "Scheduled",
      href: "/follow-ups",
      tone: data.overdueFollowUps > 0 ? ("caution" as const) : ("ink" as const),
    },
    data.showSales && {
      label: data.isSalesOnly ? "My Converted" : "Paid / Converted",
      value: data.paid, sub: `${data.conversionRate}% conversion`,
      href: "/leads", tone: "phos" as const,
    },
    data.showClasses && {
      label: "Upcoming Sessions", value: data.upcomingSessions,
      sub: "From today", href: "/classes", tone: "ink" as const,
    },
    data.showFinance && {
      label: "Certificates Due", value: data.certificatesDue,
      sub: "Completed & fully paid", href: "/students",
      tone: data.certificatesDue > 0 ? ("advisory" as const) : ("ink" as const),
    },
  ].filter(Boolean).slice(0, 6) as {
    label: string; value: number | string; sub: string; href: string;
    tone: "ink" | "phos" | "caution" | "alert" | "advisory";
  }[];

  // ── Annunciator strip: lamps that only appear when a condition is live ───
  const annunciators = [
    data.showSales && data.overdueFollowUps > 0 && {
      label: `${data.overdueFollowUps} overdue follow-up${data.overdueFollowUps === 1 ? "" : "s"}`,
      href: "/follow-ups", variant: "alert" as const,
    },
    data.showSales && data.leadsNoFollowUp > 0 && {
      label: `${data.leadsNoFollowUp} lead${data.leadsNoFollowUp === 1 ? "" : "s"} with no follow-up set`,
      href: "/leads", variant: "caution" as const,
    },
    !data.isSalesOnly && data.showSales && data.pendingEnrollmentRequests > 0 && {
      label: `${data.pendingEnrollmentRequests} enrollment request${data.pendingEnrollmentRequests === 1 ? "" : "s"} pending review`,
      href: "/enrollment-requests", variant: "caution" as const,
    },
    data.isSalesOnly && data.myPendingRequests > 0 && {
      label: `${data.myPendingRequests} of my requests awaiting review`,
      href: "/enrollment-requests", variant: "advisory" as const,
    },
  ].filter(Boolean) as { label: string; href: string; variant: "alert" | "caution" | "advisory" }[];

  const funnel = [
    { label: "Lead", value: data.fresh },
    { label: "Interested", value: data.interested },
    { label: "Enrolled", value: data.enrolled },
    { label: "Paid", value: data.paid },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-5">
      {/* ── Command strip ─────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-dim">
            {greet}, <span className="font-bold text-ink">{firstName}</span>
          </p>
          <p className="placard mt-1">{dateStr} · Sharjah</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(data.showFinance || data.showSales) && (
            <Suspense fallback={null}>
              <UrlDateFilter defaultFrom={defaultRange.from} defaultTo={defaultRange.to} />
            </Suspense>
          )}
          {data.showSales && (
            <Link href="/leads" className={solidAction}>
              <Plus className="h-4 w-4" /> Add Lead
            </Link>
          )}
          {data.showFinance && !data.showSales && (
            <Link href="/payments" className={solidAction}>
              <CircleDollarSign className="h-4 w-4" /> Record Payment
            </Link>
          )}
          {role === "trainer" && (
            <Link href="/classes" className={solidAction}>
              <CalendarDays className="h-4 w-4" /> My Classes
            </Link>
          )}
        </div>
      </section>

      {/* ── The six-pack ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sixPack.map((kpi, i) => (
          <div key={kpi.label} className="animate-power-on" style={{ animationDelay: `${i * 70}ms` }}>
            <Instrument
              label={kpi.label}
              value={typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
              sub={kpi.sub}
              tone={kpi.tone}
              href={kpi.href}
            />
          </div>
        ))}
      </section>

      {/* ── Annunciator strip — lit only when something needs a human ─────── */}
      {annunciators.length > 0 && (
        <section className="flex flex-wrap gap-2" aria-label="Attention required">
          {annunciators.map((a) => (
            <Link key={a.label} href={a.href} className="group">
              <Lamp variant={a.variant} className="px-2.5 py-1.5 text-[11px] transition group-hover:brightness-125">
                {a.label}
              </Lamp>
            </Link>
          ))}
        </section>
      )}

      {/* ── Pipeline + Follow-ups (Sales / Admin / Manager only) ─────────── */}
      {data.showSales && (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Admissions Pipeline</CardTitle>
                <CardDescription className="mt-0.5">
                  {data.leadTotal} lead{data.leadTotal === 1 ? "" : "s"} · {data.conversionRate}% reach paid
                </CardDescription>
              </div>
              <Link href="/leads" className="text-xs font-bold uppercase tracking-[0.08em] text-phos hover:underline">
                All leads
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnel.map((stage, i) => {
                  const pct = data.leadTotal > 0 ? Math.round((stage.value / data.leadTotal) * 100) : 0;
                  const width = Math.round((stage.value / funnelMax) * 100);
                  return (
                    <div key={stage.label}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="placard">{stage.label}</span>
                        <span className="readout text-xs text-dim" data-numeric>
                          {stage.value} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-sm bg-well">
                        <div
                          className="h-full rounded-sm"
                          style={{ width: `${width}%`, background: STAGE_COLORS[i] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-bezel pt-3">
                <Lamp variant={data.lost > 0 ? "off" : "ok"}>Lost / dropped</Lamp>
                <span className="readout text-sm font-bold text-dim" data-numeric>{data.lost}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Today&apos;s Follow-Ups</CardTitle>
                <CardDescription className="mt-0.5">
                  {data.todayFollowUps.length} pending today
                  {data.overdueFollowUps > 0 && ` · ${data.overdueFollowUps} overdue`}
                </CardDescription>
              </div>
              <Link href="/follow-ups" className="text-xs font-bold uppercase tracking-[0.08em] text-phos hover:underline">
                All follow-ups
              </Link>
            </CardHeader>
            <CardContent>
              {data.todayFollowUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-ctl bg-well py-10 text-center">
                  <CalendarCheck className="h-8 w-8 text-faint" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-dim">No follow-ups due today</p>
                  <p className="mt-1 text-xs text-faint">The board is clear.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.todayFollowUps.map((f) => {
                    const Icon = followUpTypeIcon[f.type] ?? BellRing;
                    const waLink = (buildWhatsAppUrl(f.phone) ?? "#");
                    return (
                      <div
                        key={f.id}
                        className="flex items-start gap-3 rounded-ctl border border-bezel bg-well px-3.5 py-2.5 transition hover:border-phos/40"
                      >
                        <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-ctl border border-bezel bg-face">
                          <Icon className="h-4 w-4 text-phos" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{f.contactName}</p>
                          {f.course && <p className="truncate text-xs text-dim">{f.course}</p>}
                          <p className="placard mt-0.5">{f.type}</p>
                        </div>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${f.contactName}`}
                          className="flex-shrink-0 rounded-ctl border border-phos/60 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-phos transition hover:bg-phos hover:text-phos-ink"
                        >
                          WA
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Trainer view — classes / sessions ───────────────────────────── */}
      {role === "trainer" && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-ctl border border-bezel bg-well">
                <CalendarDays className="h-5 w-5 text-phos" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink">Your Sessions</h2>
                <p className="text-xs text-dim">{data.upcomingSessions} upcoming from today</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/classes" className="inline-flex h-9 items-center gap-2 rounded-ctl border border-phos/60 px-4 text-xs font-bold uppercase tracking-[0.08em] text-phos transition hover:bg-phos hover:text-phos-ink">
                <CalendarDays className="h-4 w-4" /> View Classes
              </Link>
              <Link href="/courses" className="inline-flex h-9 items-center gap-2 rounded-ctl border border-bezel-strong px-4 text-xs font-bold uppercase tracking-[0.08em] text-ink transition hover:bg-well">
                <BookOpen className="h-4 w-4" /> Courses
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sales Team Performance (admin/manager only) ─────────────────── */}
      {!data.isSalesOnly && data.showSales && data.salesPerformance.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Sales Team Performance</CardTitle>
              <CardDescription className="mt-0.5">Leads by sales staff member · all time</CardDescription>
            </div>
            <Link href="/leads" className="text-xs font-bold uppercase tracking-[0.08em] text-phos hover:underline">
              View leads
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Sales Rep</Th>
                  <Th numeric>Total</Th>
                  <Th numeric>Interested</Th>
                  <Th numeric>Converted</Th>
                  <Th numeric>Overdue</Th>
                  <Th numeric>Done%</Th>
                  <Th numeric>Conv%</Th>
                </tr>
              </THead>
              <tbody>
                {data.salesPerformance.map((s) => {
                  const rate = s.total > 0 ? Math.round((s.converted / s.total) * 100) : 0;
                  const donePct = s.fuTotal > 0 ? Math.round((s.fuDone / s.fuTotal) * 100) : null;
                  return (
                    <Tr key={s.name}>
                      <Td className="font-semibold">{s.name}</Td>
                      <Td numeric>{s.total}</Td>
                      <Td numeric className="text-advisory">{s.interested}</Td>
                      <Td numeric className="text-phos">{s.converted}</Td>
                      <Td numeric className={s.overdue > 0 ? "text-alert" : "text-faint"}>{s.overdue}</Td>
                      <Td numeric>
                        {donePct === null ? (
                          <span className="text-xs text-faint">—</span>
                        ) : (
                          <Lamp variant={donePct >= 70 ? "ok" : donePct >= 40 ? "caution" : "alert"}>{donePct}%</Lamp>
                        )}
                      </Td>
                      <Td numeric>
                        <Lamp variant={rate >= 20 ? "ok" : rate >= 10 ? "caution" : "off"}>{rate}%</Lamp>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Course breakdown + Enrollments / Payments ────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {(data.showFinance || (data.showSales && !data.isSalesOnly)) && (
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Recent Enrollments</CardTitle>
                <CardDescription className="mt-0.5">Latest 6 student registrations</CardDescription>
              </div>
              <Link href="/enrollments" className="text-xs font-bold uppercase tracking-[0.08em] text-phos hover:underline">
                All enrollments
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Course</Th>
                    <Th>Status</Th>
                    {data.showFinance && <Th numeric>Paid</Th>}
                  </tr>
                </THead>
                <tbody>
                  {data.recentEnrollments.map((e) => (
                    <Tr key={e.id}>
                      <Td>
                        <p className="text-sm font-semibold text-ink">{e.fullName}</p>
                        <p className="readout text-[11px] text-faint" data-numeric>{e.enrollmentId}</p>
                      </Td>
                      <Td className="max-w-[160px]">
                        <p className="truncate text-sm text-dim" title={e.course}>{e.course}</p>
                      </Td>
                      <Td>
                        <StatusBadge status={e.status} />
                      </Td>
                      {data.showFinance && (
                        <Td numeric>
                          <p className="text-sm font-bold text-ink">AED {e.amountPaid.toLocaleString()}</p>
                          {e.amountPaid < e.totalFee && (
                            <p className="text-[11px] text-faint">of {e.totalFee.toLocaleString()}</p>
                          )}
                        </Td>
                      )}
                    </Tr>
                  ))}
                  {data.recentEnrollments.length === 0 && (
                    <tr>
                      <td colSpan={data.showFinance ? 4 : 3} className="px-6 py-10 text-center text-sm text-dim">
                        No enrollments yet.{" "}
                        <Link href="/enrollments" className="font-bold text-phos hover:underline">Add one →</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Active by Course</CardTitle>
              <CardDescription className="mt-0.5">Students currently enrolled</CardDescription>
            </div>
            <Link href="/courses" className="text-xs font-bold uppercase tracking-[0.08em] text-phos hover:underline">
              Courses
            </Link>
          </CardHeader>
          <CardContent>
            {data.courseBreakdown.length === 0 ? (
              <div className="rounded-ctl bg-well py-8 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-faint" aria-hidden />
                <p className="mt-3 text-sm text-dim">No active enrollments yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.courseBreakdown.map((c, idx) => {
                  const maxCount = Math.max(...data.courseBreakdown.map((x) => x.count));
                  const width = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0;
                  const color = `var(--chart-${(idx % 5) + 1})`;
                  return (
                    <div key={c.course}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-semibold text-dim">{c.course}</span>
                        <div className="flex flex-shrink-0 items-baseline gap-2">
                          {data.showFinance && (
                            <span className="readout text-xs text-faint" data-numeric>{fmt(c.revenue)}</span>
                          )}
                          <span className="readout text-sm font-bold text-ink" data-numeric>{c.count}</span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-sm bg-well">
                        <div className="h-full rounded-sm" style={{ width: `${width}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {data.showFinance && data.recentPayments.length > 0 && (
              <>
                <div className="mb-3 mt-6 flex items-center justify-between border-t border-bezel pt-4">
                  <p className="placard">Recent Payments</p>
                  <Link href="/payments" className="text-xs font-bold uppercase tracking-[0.08em] text-phos hover:underline">
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.recentPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-ctl bg-well px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{p.studentName}</p>
                        <p className="readout text-[11px] text-faint" data-numeric>{p.datePaid}</p>
                      </div>
                      <span className="readout ml-3 flex-shrink-0 text-sm font-bold text-phos" data-numeric>
                        {fmt(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Quick actions — quiet utility row (no duplicates of the command strip) ── */}
      <section className="flex flex-wrap gap-2">
        {data.showSales && (
          <>
            <Link href="/follow-ups" className={quietAction}>
              <BellRing className="h-4 w-4" /> Follow-Ups
            </Link>
            <Link href="/enrollments" className={quietAction}>
              <GraduationCap className="h-4 w-4" /> Enroll Student
            </Link>
          </>
        )}
        {data.showFinance && data.showSales && (
          <Link href="/payments" className={quietAction}>
            <CircleDollarSign className="h-4 w-4" /> Record Payment
          </Link>
        )}
        {data.showFinance && (
          <>
            <Link href="/expenses" className={quietAction}>
              <HandCoins className="h-4 w-4" /> Add Expense
            </Link>
            <Link href="/reports" className={quietAction}>
              <BarChart3 className="h-4 w-4" /> Reports
            </Link>
          </>
        )}
        {data.showClasses && role !== "trainer" && (
          <Link href="/classes" className={quietAction}>
            <CalendarDays className="h-4 w-4" /> Attendance
          </Link>
        )}
        {can(role, new Set(["admin", "manager", "sales", "finance"])) && (
          <Link href="/import-export" className={quietAction}>
            <ArrowUpDown className="h-4 w-4" /> Import / Export
          </Link>
        )}
      </section>
    </div>
  );
}
