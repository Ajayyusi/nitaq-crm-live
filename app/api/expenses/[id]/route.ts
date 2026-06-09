import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Expense, expenseCategories } from "@/models/Financial";
import { serializeExpense } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const allowedCategories = new Set<string>(expenseCategories);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const expense = await Expense.findById(id).lean();
  if (!expense) return NextResponse.json({ message: "Expense not found." }, { status: 404 });
  return NextResponse.json({ expense: serializeExpense(expense) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ("category" in body) {
      const v = clean(body.category);
      if (!allowedCategories.has(v)) throw new Error("Invalid category.");
      update.category = v;
    }
    if ("amount" in body) {
      const amt = Number(body.amount);
      if (amt <= 0) throw new Error("Amount must be greater than 0.");
      update.amount = amt;
    }
    if ("expenseDate" in body) update.expenseDate = body.expenseDate ? new Date(body.expenseDate) : undefined;
    for (const f of ["payee", "description", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }

    const expense = await Expense.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!expense) return NextResponse.json({ message: "Expense not found." }, { status: 404 });
    return NextResponse.json({ expense: serializeExpense(expense) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update expense.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) return NextResponse.json({ message: "Expense not found." }, { status: 404 });
  return NextResponse.json({ message: "Expense deleted." });
}
