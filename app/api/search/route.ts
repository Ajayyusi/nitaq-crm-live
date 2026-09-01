import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export interface SearchHit {
  type: string;      // group label shown in the palette
  title: string;
  subtitle: string;
  href: string;
}

const LIMIT_PER_TYPE = 5;

/**
 * Global search across the CRM. Every group is gated by the caller's role so
 * a user can never surface records they aren't allowed to open (e.g. a
 * trainer never sees leads, and only their own students).
 */
export async function GET(request: NextRequest) {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });

  await connectDB();
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const role = authed.role;
  const isAdminish = role === "admin" || role === "manager";
  const hits: SearchHit[] = [];

  const tasks: Promise<void>[] = [];

  // ── Students / registrations ──────────────────────────────────────────
  if (isAdminish || role === "finance" || role === "trainer") {
    tasks.push((async () => {
      const { default: Enrollment } = await import("@/models/Enrollment");
      const query: Record<string, unknown> = {
        $or: [{ fullName: rx }, { phone: rx }, { enrollmentId: rx }, { email: rx }],
      };
      if (role === "trainer") {
        const { getTeacherForUser } = await import("@/lib/teacher");
        const teacher = await getTeacherForUser(authed);
        if (!teacher) return;
        query.teacherId = teacher._id;
      }
      const rows = await Enrollment.find(query).limit(LIMIT_PER_TYPE).lean();
      for (const e of rows) {
        hits.push({
          type: "Students",
          title: e.fullName,
          subtitle: `${e.course}${e.enrollmentId ? ` · ${e.enrollmentId}` : ""}${e.phone ? ` · ${e.phone}` : ""}`,
          href: role === "trainer" ? "/my-students" : "/students",
        });
      }
    })());
  }

  // ── Leads ─────────────────────────────────────────────────────────────
  if (isAdminish || role === "sales") {
    tasks.push((async () => {
      const { default: Lead } = await import("@/models/Lead");
      const query: Record<string, unknown> = {
        $or: [{ fullName: rx }, { phone: rx }, { leadId: rx }, { email: rx }],
      };
      if (role === "sales") {
        const n = authed.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const own = new RegExp(`^${n}$`, "i");
        query.$and = [{ $or: [{ assignedTo: own }, { createdBy: own }] }];
      }
      const rows = await Lead.find(query).limit(LIMIT_PER_TYPE).lean();
      for (const l of rows) {
        hits.push({
          type: "Leads",
          title: l.fullName,
          subtitle: `${l.stage}${l.course ? ` · ${l.course}` : ""}${l.phone ? ` · ${l.phone}` : ""}`,
          href: "/leads",
        });
      }
    })());
  }

  // ── Courses ───────────────────────────────────────────────────────────
  tasks.push((async () => {
    const { default: Course } = await import("@/models/Course");
    const rows = await Course.find({ $or: [{ courseName: rx }, { courseCode: rx }] })
      .limit(LIMIT_PER_TYPE).lean();
    for (const c of rows) {
      hits.push({
        type: "Courses",
        title: c.courseName,
        subtitle: `${c.courseCode} · ${c.category}`,
        href: "/courses",
      });
    }
  })());

  // ── Trainers ──────────────────────────────────────────────────────────
  if (isAdminish) {
    tasks.push((async () => {
      const { default: Teacher } = await import("@/models/Teacher");
      const rows = await Teacher.find({ $or: [{ fullName: rx }, { phone: rx }, { email: rx }] })
        .limit(LIMIT_PER_TYPE).lean();
      for (const t of rows) {
        hits.push({
          type: "Trainers",
          title: t.fullName,
          subtitle: `${t.specialisation || "Trainer"}${t.phone ? ` · ${t.phone}` : ""}`,
          href: "/teachers",
        });
      }
    })());
  }

  // ── Accounting: vouchers + accounts ───────────────────────────────────
  if (role === "admin" || role === "accountant" || role === "manager") {
    tasks.push((async () => {
      const { default: JournalEntry } = await import("@/models/accounting/JournalEntry");
      const rows = await JournalEntry.find({
        $or: [{ jvNumber: rx }, { description: rx }, { sourceNumber: rx }, { reference: rx }],
      }).sort({ date: -1 }).limit(LIMIT_PER_TYPE).lean();
      for (const j of rows) {
        hits.push({
          type: "Vouchers",
          title: `${j.jvNumber} · ${j.sourceType}`,
          subtitle: `${j.date.toISOString().slice(0, 10)} · ${j.description}`,
          href: `/accounting/voucher/${j._id.toString()}`,
        });
      }
    })());

    tasks.push((async () => {
      const { default: ChartOfAccount } = await import("@/models/accounting/ChartOfAccount");
      const rows = await ChartOfAccount.find({ $or: [{ name: rx }, { code: rx }] })
        .limit(LIMIT_PER_TYPE).lean();
      for (const a of rows) {
        hits.push({
          type: "Accounts",
          title: `${a.code} — ${a.name}`,
          subtitle: `${a.type}${a.isPosting ? "" : " · group"}`,
          href: a.isPosting ? `/accounting/ledger?account=${encodeURIComponent(a.code)}` : "/accounting/coa",
        });
      }
    })());
  }

  // ── Payments / receipts ───────────────────────────────────────────────
  if (isAdminish || role === "finance") {
    tasks.push((async () => {
      const { Payment } = await import("@/models/Financial");
      const rows = await Payment.find({ $or: [{ studentName: rx }, { paymentId: rx }, { receiptRef: rx }] })
        .sort({ createdAt: -1 }).limit(LIMIT_PER_TYPE).lean();
      for (const p of rows) {
        hits.push({
          type: "Receipts",
          title: `${p.paymentId} · ${p.studentName}`,
          subtitle: `AED ${(p.amount ?? 0).toLocaleString()} · ${p.status}`,
          href: "/payments",
        });
      }
    })());
  }

  await Promise.all(tasks);
  return NextResponse.json({ hits });
}
