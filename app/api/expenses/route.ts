import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Expense, expenseCategories, expensePaymentMethods } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializeExpense } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { parseAmount } from "@/lib/money";
import { apiError } from "@/lib/api-error";
import { parseOptionalDate } from "@/lib/mongo-update";
import { preflightJournalEntry } from "@/lib/accounting/engine";
import { planExpensePaid, postForNewDocument, splitInclusiveVat } from "@/lib/accounting/postings";

const allowedCategories = new Set<string>(expenseCategories);
const allowedExpenseMethods = new Set<string>(expensePaymentMethods);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search")?.trim();

    const query: Record<string, unknown> = {};
    if (category && allowedCategories.has(category)) query.category = category;
    if (from || to) {
      const dateQ: Record<string, Date> = {};
      if (from) dateQ.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); dateQ.$lt = t; }
      query.expenseDate = dateQ;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ payee: regex }, { description: regex }, { expenseId: regex }];
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();
    const total = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

    return NextResponse.json({ expenses: expenses.map(serializeExpense), total });
  } catch (error) {
    return apiError(error, "Failed to load expenses.", "expenses");
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const body = await request.json();

    const category = clean(body.category);
    if (!allowedCategories.has(category)) throw new Error("Invalid category.");
    const total = parseAmount(body.amount);
    const paymentMethod = clean(body.paymentMethod);
    const { vatRate, vatAmount, amountBeforeVAT } = await splitInclusiveVat(total, body.vatRate);

    const seq = await getNextSequence("expense");
    const expenseId = `EXP-${String(seq).padStart(3, "0")}`;

    const expense = new Expense({
      expenseId,
      category,
      amount: total,
      expenseDate: parseOptionalDate(body.expenseDate, "Expense date") ?? new Date(),
      payee: clean(body.payee) || undefined,
      paymentMethod: allowedExpenseMethods.has(paymentMethod) ? paymentMethod : undefined,
      description: clean(body.description) || undefined,
      notes: clean(body.notes) || undefined,
      vatRate, vatAmount, amountBeforeVAT,
      expenseAccountCode: clean(body.expenseAccountCode) || undefined,
    });

    // Auto double-entry: Dr Expense (+ Dr Input VAT) / Cr Cash-Bank-Petty.
    // Validated before saving, so a locked period or a non-expense account is
    // refused instead of producing an expense the ledger never sees.
    const plan = await planExpensePaid({
      sourceId: expense._id.toString(),
      sourceNumber: expenseId,
      date: expense.expenseDate,
      expenseAccountCode: expense.expenseAccountCode,
      category,
      description: expense.description ?? "",
      amountBeforeVAT, vatAmount,
      paymentMethod: paymentMethod || "Cash",
      createdBy: authed.name,
    });
    if (plan) await preflightJournalEntry(plan);

    await expense.save();
    const { entry, postingError } = await postForNewDocument(plan);
    if (entry || postingError) {
      if (entry) expense.journalEntryId = entry._id as never;
      if (postingError) expense.postingError = postingError;
      await expense.save();
    }

    await logAudit({
      userName: authed.name, userRole: authed.role, action: "created", entity: "Expense",
      entityId: expense._id.toString(), entityLabel: `${expenseId} · ${category}`,
      detail: `AED ${total} (VAT ${vatAmount})${postingError ? ` · LEDGER POSTING FAILED: ${postingError}` : ""}`,
    });

    return NextResponse.json(
      {
        expense: serializeExpense(expense),
        ...(postingError ? { warning: `Expense saved, but the accounting entry failed: ${postingError}` } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Failed to record expense.", "expenses");
  }
}
