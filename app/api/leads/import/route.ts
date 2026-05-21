import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { leadSources, leadStatuses } from "@/constants/leads";

const columns = ["fullName", "phone", "email", "interestedCourse", "source", "status", "nextFollowUpDate", "assignedTo", "notes"];
const allowedStatuses = new Set<string>(leadStatuses);
const allowedSources = new Set<string>(leadSources);

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(header: string) {
  return header.trim().replace(/^\uFEFF/, "");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Please upload a CSV file." }, { status: 400 });
    }

    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      return NextResponse.json({ message: "CSV must include a header row and at least one lead." }, { status: 400 });
    }

    const headers = rows[0].map(normalizeHeader);
    const missingColumns = ["fullName", "phone", "interestedCourse"].filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      return NextResponse.json({ message: `Missing required CSV columns: ${missingColumns.join(", ")}` }, { status: 400 });
    }

    await connectDB();

    let created = 0;
    const errors: string[] = [];

    for (const [rowIndex, row] of rows.slice(1).entries()) {
      const data = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));
      const line = rowIndex + 2;
      const source = data.source || "Other";
      const status = data.status || "New";

      if (!data.fullName || !data.phone || !data.interestedCourse) {
        errors.push(`Row ${line}: fullName, phone, and interestedCourse are required.`);
        continue;
      }
      if (!allowedSources.has(source)) {
        errors.push(`Row ${line}: source must be one of ${leadSources.join(", ")}.`);
        continue;
      }
      if (!allowedStatuses.has(status)) {
        errors.push(`Row ${line}: status must be one of ${leadStatuses.join(", ")}.`);
        continue;
      }

      await Lead.create({
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || undefined,
        interestedCourse: data.interestedCourse,
        source,
        status,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
        assignedTo: data.assignedTo || undefined,
        notes: data.notes || undefined,
      });
      created += 1;
    }

    return NextResponse.json({ created, failed: errors.length, errors, supportedColumns: columns });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import leads.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
