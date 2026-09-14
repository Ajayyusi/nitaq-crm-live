import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Expense, expenseCategories, expensePaymentMethods } from "@/models/Financial";
import JournalEntry from "@/models/accounting/JournalEntry";
import { serializeExpense } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { parseAmount, round2 } from "@/lib/money";
import { apiError } from "@/lib/api-error";
import { parseOptionalDate, sameDay, toMongoUpdate } from "@/lib/mongo-update";
import { planExpensePaid, syncSourceEntry } from "@/lib/accounting/postings";

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

    const existing = await Expense.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Expense not found." }, { status: 404 });

    const update: Record<string, unknown> = {};

    if ("category" in body) {
      const v = clean(body.category);
      if (!allowedCategories.has(v)) throw new Error("Invalid category.");
      update.category = v;
    }
    if ("amount" in body) update.amount = parseAmount(body.amount);
    if ("expenseDate" in body) {
      const d = parseOptionalDate(body.expenseDate, "Expense date");
      if (!d) throw new Error("Expense date is required.");
      if (!sameDay(d, existing.expenseDate)) update.expenseDate = d;
    }
    if ("paymentMethod" in body) {
      const v = clean(body.paymentMethod);
      update.paymentMethod = allowedExpenseMethods.has(v) ? v : undefined;
    }
    for (const f of ["payee", "description", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    // Expense ledger account (Chart of Accounts) — the account the payment posts to
    if ("expenseAccountCode" in body) update.expenseAccountCode = clean(body.expenseAccountCode) || undefined;

    const next = { ...existing, ...update };

    // The VAT split always follows the current amount — it used to be
    // recomputed only when an entry existed, so stale figures could be posted.
    if (next.amount !== existing.amount) {
      const vatRate = existing.vatRate ?? 0;
      const vatAmount = vatRate > 0 ? round2(next.amount * vatRate / (100 + vatRate)) : 0;
      update.vatAmount = next.vatAmount = vatAmount;
      update.amountBeforeVAT = next.amountBeforeVAT = round2(next.amount - vatAmount);
    }

    const moneyChanged =
      next.amount !== existing.amount ||
      next.category !== existing.category ||
      next.paymentMethod !== existing.paymentMethod ||
      next.expenseAccountCode !== existing.expenseAccountCode ||
      "expenseDate" in update;
    // An expense with no live entry (e.g. broken by the old edit bug) is
    // re-posted on its next edit.
    const missingEntry =
      !moneyChanged &&
      !(await JournalEntry.exists({ sourceType: "Expense", sourceId: id, status: "Posted" }));
    const affectsLedger = moneyChanged || missingEntry;

    const plan = affectsLedger
      ? await planExpensePaid({
          sourceId: id,
          sourceNumber: existing.expenseId,
          date: next.expenseDate ?? new Date(),
          expenseAccountCode: next.expenseAccountCode,
          category: next.category,
          description: next.description ?? "",
          amountBeforeVAT: next.amountBeforeVAT ?? next.amount,
          vatAmount: next.vatAmount ?? 0,
          paymentMethod: next.paymentMethod ?? "Cash",
          createdBy: authed.name,
        })
      : null;
    if (affectsLedger) {
      update.journalEntryId = undefined;
      update.postingError = undefined;
    }

    const sync = await syncSourceEntry({
      sourceTypes: ["Expense"],
      sourceId: id,
      plan,
      affectsLedger,
      actor: authed.name,
      reason: "Expense edited in CRM",
      applyChange: () => Expense.findByIdAndUpdate(id, toMongoUpdate(update), { new: true, runValidators: true }),
    });
    const expense = sync.result;
    if (!expense) return NextResponse.json({ message: "Expense not found." }, { status: 404 });
    if (sync.entry || sync.postingError) {
      if (sync.entry) expense.journalEntryId = sync.entry._id as never;
      if (sync.postingError) expense.postingError = sync.postingError;
      await expense.save();
    }

    await logAudit({
      userName: authed.name, userRole: authed.role, action: "updated", entity: "Expense",
      entityId: id, entityLabel: `${expense.expenseId} · ${expense.category}`,
      detail: `AED ${existing.amount} → ${expense.amount}` +
        `${sync.postingError ? ` · LEDGER POSTING FAILED: ${sync.postingError}` : ""}`,
    });

    return NextResponse.json({
      expense: serializeExpense(expense),
      ...(sync.postingError ? { warning: `Expense saved, but the accounting entry failed: ${sync.postingError}` } : {}),
    });
  } catch (error) {
    return apiError(error, "Failed to update expense.", "expenses");
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "finance"]);
  if (authed instanceof NextResponse) return authed;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const existing = await Expense.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Expense not found." }, { status: 404 });

    // Reverse first, so a locked period keeps the expense instead of leaving
    // a live entry for an expense that no longer exists.
    const sync = await syncSourceEntry({
      sourceTypes: ["Expense"],
      sourceId: id,
      plan: null,
      affectsLedger: true,
      actor: authed.name,
      reason: "Expense deleted in CRM",
      order: "reverse-first",
      applyChange: () => Expense.findByIdAndDelete(id),
    });

    // Expense deletion used to leave no audit trail at all.
    await logAudit({
      userName: authed.name, userRole: authed.role, action: "deleted", entity: "Expense",
      entityId: id, entityLabel: `${existing.expenseId} · ${existing.category}`,
      detail: `AED ${existing.amount}${sync.reversed ? ` · reversal ${sync.reversed.jvNumber}` : ""}`,
    });
    return NextResponse.json({ message: "Expense deleted." });
  } catch (error) {
    return apiError(error, "Failed to delete expense.", "expenses");
  }
}
