import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Expense, expenseCategories, expensePaymentMethods } from "@/models/Financial";
import { serializeExpense } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { postExpensePaid, postSafely, reverseEntryForSource } from "@/lib/accounting/postings";

type RouteContext = { params: Promise<{ id: string }> };

const allowedCategories = new Set<string>(expenseCategories);
const allowedExpenseMethods = new Set<string>(expensePaymentMethods);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


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
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


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
    if ("paymentMethod" in body) {
      const v = clean(body.paymentMethod);
      update.paymentMethod = allowedExpenseMethods.has(v) ? v : undefined;
    }
    for (const f of ["payee", "description", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    // Expense ledger account (Chart of Accounts) — the account the payment posts to
    if ("expenseAccountCode" in body) update.expenseAccountCode = clean(body.expenseAccountCode) || undefined;

    // Books must follow the CRM: reverse the old entry when money facts change
    const existing = await Expense.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Expense not found." }, { status: 404 });
    const affectsEntry =
      ("amount" in update && update.amount !== existing.amount) ||
      ("category" in update && update.category !== existing.category) ||
      ("paymentMethod" in update && update.paymentMethod !== existing.paymentMethod) ||
      ("expenseAccountCode" in update && update.expenseAccountCode !== existing.expenseAccountCode) ||
      ("expenseDate" in update);
    if (affectsEntry && existing.journalEntryId) {
      await postSafely(() => reverseEntryForSource("Expense", id, authed.name, "Expense edited in CRM"));
      update.journalEntryId = undefined;
      // recompute VAT split on the new amount (keeps prior vatRate)
      const total = Number(update.amount ?? existing.amount) || 0;
      const vatRate = existing.vatRate ?? 0;
      const vatAmount = vatRate > 0 ? Math.round(total * vatRate / (100 + vatRate) * 100) / 100 : 0;
      update.vatAmount = vatAmount;
      update.amountBeforeVAT = Math.round((total - vatAmount) * 100) / 100;
    }

    const expense = await Expense.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!expense) return NextResponse.json({ message: "Expense not found." }, { status: 404 });

    // Re-post if the active entry was reversed above
    if (affectsEntry && !expense.journalEntryId) {
      const entry = await postSafely(() => postExpensePaid({
        sourceId: id,
        sourceNumber: expense.expenseId,
        date: expense.expenseDate ?? new Date(),
        expenseAccountCode: expense.expenseAccountCode,
        category: expense.category,
        description: expense.description ?? "",
        amountBeforeVAT: expense.amountBeforeVAT ?? expense.amount,
        vatAmount: expense.vatAmount ?? 0,
        paymentMethod: expense.paymentMethod ?? "Cash",
        createdBy: authed.name,
      }));
      if (entry) {
        expense.journalEntryId = entry._id as never;
        await expense.save();
      }
    }

    return NextResponse.json({ expense: serializeExpense(expense) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update expense.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) return NextResponse.json({ message: "Expense not found." }, { status: 404 });
  // Keep the books in sync: reverse this expense's journal entry
  await postSafely(() => reverseEntryForSource("Expense", id, authed.name, "Expense deleted in CRM"));
  return NextResponse.json({ message: "Expense deleted." });
}
