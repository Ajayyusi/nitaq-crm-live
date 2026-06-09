import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { getNextSequence } from "@/models/Counter";
import { leadSources, leadStages, courseList } from "@/constants/leads";

const allowedStages = new Set<string>(leadStages);
const allowedSources = new Set<string>(leadSources);
const allowedCourses = new Set<string>(courseList);

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') { cell += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else { cell += char; }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(h: string) {
  return h.trim().replace(/^﻿/, "");
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
    const missing = ["fullName", "phone"].filter((c) => !headers.includes(c));
    if (missing.length) {
      return NextResponse.json({ message: `Missing required columns: ${missing.join(", ")}` }, { status: 400 });
    }

    await connectDB();
    let created = 0;
    const errors: string[] = [];

    for (const [idx, row] of rows.slice(1).entries()) {
      const data = Object.fromEntries(headers.map((h, i) => [h, row[i]?.trim() ?? ""]));
      const line = idx + 2;
      const source = data.source || "Other";
      const stage = data.stage || "Lead";
      const course = data.course || "Other";

      if (!data.fullName || !data.phone) {
        errors.push(`Row ${line}: fullName and phone are required.`);
        continue;
      }
      if (!allowedSources.has(source)) {
        errors.push(`Row ${line}: source must be one of: ${[...allowedSources].join(", ")}.`);
        continue;
      }
      if (!allowedStages.has(stage)) {
        errors.push(`Row ${line}: stage must be one of: ${[...allowedStages].join(", ")}.`);
        continue;
      }
      if (!allowedCourses.has(course)) {
        errors.push(`Row ${line}: course must be one of: ${[...allowedCourses].join(", ")}.`);
        continue;
      }

      const seq = await getNextSequence("lead");
      const leadId = `L-${String(seq).padStart(3, "0")}`;

      await Lead.create({
        leadId,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || undefined,
        course,
        source,
        stage,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
        assignedTo: data.assignedTo || undefined,
        notes: data.notes || undefined,
      });
      created++;
    }

    return NextResponse.json({ created, failed: errors.length, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import leads.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
