import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";
import { requireAuth } from "@/lib/api-auth";
import { buildDateFilter } from "@/lib/dateRange";

const esc = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Downloads the business report (all sections) as one Excel-compatible CSV. */
export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const dateFilter = buildDateFilter(from, to);

  const paymentMatch: Record<string, unknown> = { status: "Received" };
  if (dateFilter) paymentMatch.datePaid = dateFilter;
  const expenseMatch: Record<string, unknown> = {};
  if (dateFilter) expenseMatch.expenseDate = dateFilter;
  const createdMatch: Record<string, unknown> = {};
  if (dateFilter) createdMatch.createdAt = dateFilter;

  const [payByMethod, payByCourse, expByCategory, leadsByStage, leadsBySource, enrollByCourse, totals] =
    await Promise.all([
      Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: "$course", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Lead.aggregate([{ $match: createdMatch }, { $group: { _id: "$stage", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Lead.aggregate([{ $match: createdMatch }, { $group: { _id: "$source", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Enrollment.aggregate([{ $match: createdMatch }, { $group: { _id: "$course", count: { $sum: 1 }, fees: { $sum: "$totalFee" }, paid: { $sum: "$amountPaid" } } }, { $sort: { fees: -1 } }]),
      Promise.all([
        Payment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, t: { $sum: "$amount" } } }]),
        Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, t: { $sum: "$amount" } } }]),
      ]),
    ]);

  const revenue = totals[0][0]?.t ?? 0;
  const expensesTotal = totals[1][0]?.t ?? 0;

  const L: string[] = [];
  L.push(`Nitaq Academy — Business Report`);
  L.push(`Period,${from || "start"} to ${to || "today"}`);
  L.push(`Generated,${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  L.push("");
  L.push("SUMMARY");
  L.push("Metric,Amount (AED)");
  L.push(`Revenue (received),${revenue}`);
  L.push(`Expenses,${expensesTotal}`);
  L.push(`Net,${revenue - expensesTotal}`);
  L.push("");
  L.push("REVENUE BY PAYMENT METHOD");
  L.push("Method,Payments,Total (AED)");
  for (const r of payByMethod) L.push([esc(r._id ?? "—"), r.count, r.total].join(","));
  L.push("");
  L.push("REVENUE BY COURSE");
  L.push("Course,Payments,Total (AED)");
  for (const r of payByCourse) L.push([esc(r._id ?? "—"), r.count, r.total].join(","));
  L.push("");
  L.push("EXPENSES BY CATEGORY");
  L.push("Category,Entries,Total (AED)");
  for (const r of expByCategory) L.push([esc(r._id ?? "—"), r.count, r.total].join(","));
  L.push("");
  L.push("ENROLLMENTS BY COURSE");
  L.push("Course,Students,Total Fees (AED),Collected (AED)");
  for (const r of enrollByCourse) L.push([esc(r._id ?? "—"), r.count, r.fees, r.paid].join(","));
  L.push("");
  L.push("LEADS BY STAGE");
  L.push("Stage,Count");
  for (const r of leadsByStage) L.push([esc(r._id ?? "—"), r.count].join(","));
  L.push("");
  L.push("LEADS BY SOURCE");
  L.push("Source,Count");
  for (const r of leadsBySource) L.push([esc(r._id ?? "—"), r.count].join(","));

  return new NextResponse("﻿" + L.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nitaq-report-${from || "all"}-${to || "all"}.csv"`,
    },
  });
}
