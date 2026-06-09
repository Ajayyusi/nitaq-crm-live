import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Expense, expenseCategories } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializeExpense } from "@/lib/serializers";

const allowedCategories = new Set<string>(expenseCategories);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
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
  try {
    await connectDB();
    const body = await request.json();

    const category = clean(body.category);
    if (!allowedCategories.has(category)) throw new Error("Invalid category.");
    if (!body.amount || Number(body.amount) <= 0) throw new Error("Amount must be greater than 0.");

    const seq = await getNextSequence("expense");
    const expenseId = `EXP-${String(seq).padStart(3, "0")}`;

    const expense = await Expense.create({
      expenseId,
      category,
      amount: Number(body.amount),
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
      payee: clean(body.payee) || undefined,
      description: clean(body.description) || undefined,
      notes: clean(body.notes) || undefined,
    });

    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record expense.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
