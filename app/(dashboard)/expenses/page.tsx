"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Drawer, ConfirmDialog } from "@/components/ui/dialog";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { Instrument } from "@/components/ui/instrument";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";
import { expenseCategories, expensePaymentMethods } from "@/constants/modelConstants";
import { thisMonthRange, describeRange } from "@/lib/dateRange";

type Expense = {
  id: string; expenseId: string; category: string; amount: number;
  expenseDate: string; payee: string; paymentMethod: string; description: string; notes: string;
  expenseAccountCode?: string;
};

const today = new Date().toISOString().slice(0, 10);
const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BLANK = {
  category: "Other", amount: "", expenseDate: today,
  payee: "", paymentMethod: "", description: "", notes: "", expenseAccountCode: "",
};

type FieldErrors = { amount?: string };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [total, setTotal] = useState(0);
  // All posting expense accounts from the chart of accounts (for booking to the right ledger)
  const [coaExpenseAccounts, setCoaExpenseAccounts] = useState<{ code: string; name: string }[]>([]);
  const [coaLoadFailed, setCoaLoadFailed] = useState(false);
  useEffect(() => {
    fetch("/api/accounting/accounts?posting=true&type=Expense")
      .then((r) => r.json())
      .then((d) => setCoaExpenseAccounts((d.accounts ?? []).map((a: { code: string; name: string }) => ({ code: a.code, name: a.name }))))
      .catch(() => setCoaLoadFailed(true));
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const params = new URLSearchParams();
      if (catFilter !== "All") params.set("category", catFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLoadFailed(true);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [catFilter, dateFrom, dateTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function openNew() {
    setEditTarget(null);
    setForm({ ...BLANK });
    setFormError("");
    setFieldErrors({});
    setDrawerOpen(true);
  }

  function openEdit(e: Expense) {
    setEditTarget(e);
    setForm({
      category: e.category, amount: String(e.amount),
      expenseDate: e.expenseDate, payee: e.payee,
      paymentMethod: e.paymentMethod,
      description: e.description, notes: e.notes,
      expenseAccountCode: e.expenseAccountCode ?? "",
    });
    setFormError("");
    setFieldErrors({});
    setDrawerOpen(true);
  }

  async function save() {
    const errors: FieldErrors = {};
    if (!form.amount || Number(form.amount) <= 0) errors.amount = "Enter an amount greater than 0.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setFormError("");
    try {
      const url = editTarget ? `/api/expenses/${editTarget.id}` : "/api/expenses";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      }).then((r) => r.json());
      if (res.message && !res.expense) throw new Error(res.message);
      setDrawerOpen(false);
      fetchExpenses();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save this expense. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await fetch(`/api/expenses/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      void fetchExpenses();
    } catch {
      setDeleteError("Couldn't delete this expense. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const periodLabel = describeRange(dateFrom, dateTo);
  const { slice, page, pages, setPage, total: rowTotal } = usePagination(expenses, 50);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Operating costs — rent, salaries, supplies and other outgoings"
        actions={
          <Button variant="solid" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden /> Add Expense
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Total + category breakdown */}
        <div className="grid gap-3 md:grid-cols-3">
          <Instrument
            label={catFilter === "All" ? `Expenses (${periodLabel})` : `${catFilter} (${periodLabel})`}
            value={fmt(total)}
            sub="Total for the current view"
          />
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <p className="placard mb-3">By Category</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const active = catFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCatFilter(active ? "All" : cat)}
                      className={`flex items-center gap-1.5 rounded-ctl border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-phos bg-phos text-phos-ink"
                          : "border-bezel bg-well text-dim hover:border-bezel-strong hover:text-ink"
                      }`}
                    >
                      {cat}
                      <span className="readout font-semibold" data-numeric>{fmt(amt)}</span>
                    </button>
                  );
                })}
                {Object.keys(byCategory).length === 0 && (
                  <p className="text-xs text-faint">No expenses in the current view</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          />
          <Select
            aria-label="Filter by category"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-auto"
          >
            <option value="All">All Categories</option>
            {expenseCategories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>

        {/* Table */}
        {loadFailed ? (
          <LoadError
            message="Couldn't load expenses. Check your connection and retry."
            onRetry={fetchExpenses}
          />
        ) : loading ? (
          <TableShell>
            <SkeletonRows rows={6} cols={6} />
          </TableShell>
        ) : expenses.length === 0 ? (
          <TableShell>
            <EmptyState
              icon={Receipt}
              title="No expenses found"
              description="No expenses match the current filters. Add one to start tracking costs."
              action={
                <Button variant="primary" onClick={openNew}>
                  <Plus className="h-4 w-4" aria-hidden /> Add Expense
                </Button>
              }
            />
          </TableShell>
        ) : (
          <TableShell>
            <Table className="min-w-[640px]">
              <THead>
                <tr>
                  <Th>ID</Th>
                  <Th>Category</Th>
                  <Th>Description / Payee</Th>
                  <Th numeric>Amount</Th>
                  <Th>Method</Th>
                  <Th>Date</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </tr>
              </THead>
              <tbody>
                {slice.map((e) => (
                  <Tr key={e.id} clickable onClick={() => openEdit(e)}>
                    <Td className="readout text-xs text-faint" data-numeric>{e.expenseId}</Td>
                    <Td className="text-dim">{e.category}</Td>
                    <Td>
                      <div className="font-semibold">{e.description || "—"}</div>
                      {e.payee && <div className="text-xs text-faint">{e.payee}</div>}
                    </Td>
                    <Td numeric className="whitespace-nowrap font-semibold">{fmt(e.amount)}</Td>
                    <Td className="whitespace-nowrap text-xs text-dim">{e.paymentMethod || "—"}</Td>
                    <Td className="whitespace-nowrap text-dim">{e.expenseDate}</Td>
                    <Td className="whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => openEdit(e)}
                        aria-label={`Edit expense ${e.expenseId}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-dim hover:text-alert"
                        onClick={() => { setDeleteError(""); setDeleteTarget(e); }}
                        aria-label={`Delete expense ${e.expenseId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <Pagination page={page} pages={pages} setPage={setPage} total={rowTotal} shown={slice.length} />
            </TableFooter>
          </TableShell>
        )}
      </div>

      {/* Add / edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? `Edit ${editTarget.expenseId}` : "Add Expense"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Update Expense" : "Add Expense"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" required htmlFor="exp-category">
              <Select
                id="exp-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {expenseCategories.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Amount (AED)" required error={fieldErrors.amount} htmlFor="exp-amount">
              <Input
                id="exp-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => {
                  setForm((f) => ({ ...f, amount: e.target.value }));
                  if (fieldErrors.amount) setFieldErrors({});
                }}
                placeholder="0.00"
              />
            </Field>
          </div>

          {/* Post to a specific expense ledger account (from the Chart of Accounts) */}
          <Field
            label="Expense Account (ledger)"
            htmlFor="exp-account"
            help={
              coaLoadFailed
                ? "Ledger accounts couldn't be loaded — the default expense account will be used."
                : undefined
            }
          >
            <Select
              id="exp-account"
              value={form.expenseAccountCode}
              onChange={(e) => setForm((f) => ({ ...f, expenseAccountCode: e.target.value }))}
            >
              <option value="">Auto (use default expense account)</option>
              {coaExpenseAccounts.map((a) => (
                <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required>
              <DatePicker
                value={form.expenseDate}
                onChange={(v) => setForm((f) => ({ ...f, expenseDate: v }))}
                required
              />
            </Field>
            <Field label="Payment Method" htmlFor="exp-method">
              <Select
                id="exp-method"
                value={form.paymentMethod}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              >
                <option value="">— None —</option>
                {expensePaymentMethods.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Payee / Supplier" htmlFor="exp-payee">
            <Input
              id="exp-payee"
              value={form.payee}
              onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
              placeholder="Company or person"
            />
          </Field>

          <Field label="Description" htmlFor="exp-desc">
            <Input
              id="exp-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What was this expense for?"
            />
          </Field>

          <Field label="Notes" htmlFor="exp-notes">
            <Textarea
              id="exp-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional details…"
            />
          </Field>
        </div>
      </Drawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete Expense"
        confirmLabel="Delete"
        message={
          <>
            Delete expense <strong className="text-ink">{deleteTarget?.expenseId}</strong>{" "}
            ({deleteTarget?.category})? This permanently removes the financial record and cannot
            be undone.
            {deleteError && (
              <span role="alert" className="mt-2 block font-semibold text-alert">{deleteError}</span>
            )}
          </>
        }
      />
    </div>
  );
}
