import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { requireAuth } from "@/lib/api-auth";

const columns = [
  "leadId",
  "fullName",
  "phone",
  "email",
  "course",
  "source",
  "stage",
  "nextFollowUpDate",
  "assignedTo",
  "notes",
];

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(req: Request) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") ?? "";
  const source = searchParams.get("source") ?? "";
  const course = searchParams.get("course") ?? "";
  const assignedTo = searchParams.get("assignedTo") ?? "";
  const search = searchParams.get("search") ?? "";

  try {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    // Sales role: restrict to own leads
    if (authed.role === "sales") {
      const nameRx = new RegExp(`^${authed.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      filter.$or = [{ assignedTo: nameRx }, { createdBy: nameRx }];
    }

    if (stage) filter.stage = stage;
    if (source) filter.source = source;
    if (course) filter.course = course;
    if (assignedTo && authed.role !== "sales") filter.assignedTo = assignedTo;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchOr = [{ fullName: rx }, { phone: rx }, { course: rx }];
      filter.$and = filter.$or
        ? [{ $or: filter.$or }, { $or: searchOr }]
        : [{ $or: searchOr }];
      if (filter.$or) delete filter.$or;
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 }).lean();

    const lines = [
      columns.join(","),
      ...leads.map((lead) =>
        columns
          .map((col) => {
            if (col === "nextFollowUpDate") {
              return csvEscape(
                lead.nextFollowUpDate
                  ? (lead.nextFollowUpDate as Date).toISOString().slice(0, 10)
                  : "",
              );
            }
            return csvEscape((lead as any)[col]);
          })
          .join(","),
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nitaq-leads.csv"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export leads.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
