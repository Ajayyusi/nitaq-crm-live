import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";

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

export async function GET() {
  try {
    await connectDB();
    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();

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
