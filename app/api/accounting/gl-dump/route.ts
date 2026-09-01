import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import JournalEntry from "@/models/accounting/JournalEntry";
import { requireAuth } from "@/lib/api-auth";
import { csvEscape as esc } from "@/lib/utils";
import { buildDateFilter } from "@/lib/dateRange";

/**
 * Full General Ledger dump — every line of every posted entry, flattened.
 * ?format=csv streams a CSV file (Excel-compatible); default returns JSON.
 */
export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const dateFilter = buildDateFilter(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);

  const query: Record<string, unknown> = { status: { $in: ["Posted", "Reversed"] } };
  if (dateFilter) query.date = dateFilter;

  const entries = await JournalEntry.find(query).sort({ date: 1, createdAt: 1 }).lean();

  const rows = entries.flatMap((e) =>
    e.lines.map((l) => ({
      date: e.date.toISOString().slice(0, 10),
      jvNumber: e.jvNumber,
      status: e.status,
      sourceType: e.sourceType,
      sourceNumber: e.sourceNumber ?? "",
      reference: e.reference ?? "",
      accountCode: l.accountCode,
      accountName: l.accountName,
      description: l.description || e.description,
      debit: l.debit,
      credit: l.credit,
      student: l.studentRef ?? "",
      supplier: l.supplierRef ?? "",
      course: l.courseRef ?? "",
      createdBy: e.createdBy,
      postedBy: e.postedBy ?? "",
    }))
  );

  if (searchParams.get("format") === "csv") {
    const headers = [
      "Date", "Voucher", "Status", "Source", "Source No", "Reference",
      "Account Code", "Account Name", "Description", "Debit", "Credit",
      "Student", "Supplier", "Course", "Created By", "Posted By",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) => [
        r.date, r.jvNumber, r.status, r.sourceType, r.sourceNumber, r.reference,
        r.accountCode, r.accountName, r.description, r.debit, r.credit,
        r.student, r.supplier, r.course, r.createdBy, r.postedBy,
      ].map(esc).join(",")),
    ].join("\n");

    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gl-dump-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, count: rows.length });
}
