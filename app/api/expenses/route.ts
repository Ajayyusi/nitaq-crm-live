import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Expense, expenseCategories, expensePaymentMethods } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializeExpense } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { postExpensePaid, postSafely } from "@/lib/accounting/postings";

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
    const message = error instanceof Error ? error.message : "Failed to load expenses.";
    return NextResponse.json({ message }, { status: 500 });
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
    if (!body.amount || Number(body.amount) <= 0) throw new Error("Amount must be greater than 0.");

    const seq = await getNextSequence("expense");
    const expenseId = `EXP-${String(seq).padStart(3, "0")}`;

    const paymentMethod = clean(body.paymentMethod);
    const total = Math.round(Number(body.amount) * 100) / 100;
    // VAT breakdown: amount is VAT-inclusive when a vatRate is supplied
    const vatRate = Math.max(0, Number(body.vatRate) || 0);
    const vatAmount = vatRate > 0 ? Math.round(total * vatRate / (100 + vatRate) * 100) / 100 : 0;
    const amountBeforeVAT = Math.round((total - vatAmount) * 100) / 100;

    const expense = await Expense.create({
      expenseId,
      category,
      amount: total,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
      payee: clean(body.payee) || undefined,
      paymentMethod: allowedExpenseMethods.has(paymentMethod) ? paymentMethod : undefined,
      description: clean(body.description) || undefined,
      notes: clean(body.notes) || undefined,
      vatRate, vatAmount, amountBeforeVAT,
      expenseAccountCode: clean(body.expenseAccountCode) || undefined,
    });

    // Auto double-entry: Dr Expense (+ Dr Input VAT) / Cr Cash-Bank-Petty
    const entry = await postSafely(() => postExpensePaid({
      sourceId: expense._id.toString(),
      sourceNumber: expenseId,
      date: expense.expenseDate,
      expenseAccountCode: expense.expenseAccountCode,
      category,
      description: expense.description ?? "",
      amountBeforeVAT, vatAmount,
      paymentMethod: paymentMethod || "Cash",
      createdBy: authed.name,
    }));
    if (entry) {
      expense.journalEntryId = entry._id as never;
      await expense.save();
    }

    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record expense.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
