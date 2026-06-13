"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Receipt, TrendingDown, X, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { expenseCategories, expensePaymentMethods } from "@/constants/modelConstants";
import { thisMonthRange, describeRange } from "@/lib/dateRange";

type Expense = {
  id: string; expenseId: string; category: string; amount: number;
  expenseDate: string; payee: string; paymentMethod: string; description: string; notes: string;
};

const today = new Date().toISOString().slice(0, 10);
const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const catColors: Record<string, string> = {
  "Rent": "bg-indigo-100 text-indigo-700",
  "Salaries": "bg-purple-100 text-purple-700",
  "Utilities": "bg-blue-100 text-blue-700",
  "Marketing": "bg-pink-100 text-pink-700",
  "Supplies": "bg-amber-100 text-amber-700",
  "Maintenance": "bg-orange-100 text-orange-700",
  "Insurance": "bg-cyan-100 text-cyan-700",
  "Training Materials": "bg-teal-100 text-teal-700",
  "Software & Subscriptions": "bg-violet-100 text-violet-700",
  "Equipment": "bg-lime-100 text-lime-700",
  "Transport": "bg-sky-100 text-sky-700",
  "Government Fees": "bg-red-100 text-red-700",
  "Other": "bg-slate-100 text-slate-600",
};

const cls =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const BLANK = {
  category: "Other", amount: "", expenseDate: today,
  payee: "", paymentMethod: "", description: "", notes: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
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
      setError("Could not load expenses. Please check your connection.");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [catFilter, dateFrom, dateTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function openNew() {
    setEditTarget(null);
    setForm({ ...BLANK });
    setError("");
    setDrawerOpen(true);
  }

  function openEdit(e: Expense) {
    setEditTarget(e);
    setForm({
      category: e.category, amount: String(e.amount),
      expenseDate: e.expenseDate, payee: e.payee,
      paymentMethod: e.paymentMethod,
      description: e.description, notes: e.notes,
    });
    setError("");
    setDrawerOpen(true);
  }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) { setError("Amount must be greater than 0."); return; }
    setSaving(true);
    setError("");
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
      setError(e instanceof Error ? e.message : "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(e: Expense) {
    if (!confirm(`Delete expense ${e.expenseId} (${e.category})? This will permanently remove this financial record and cannot be undone.`)) return;
    try {
      await fetch(`/api/expenses/${e.id}`, { method: "DELETE" });
      void fetchExpenses();
    } catch {
      setError("Failed to delete expense.");
    }
  }

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const periodLabel = describeRange(dateFrom, dateTo);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Expenses"
        subtitle="Track operating costs and supplier payments"
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] text-white text-sm font-medium rounded-lg hover:bg-[#1B5E20] transition"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        }
      />

      {/* KPI + breakdown */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">
              {catFilter === "All" ? `Expenses (${periodLabel})` : `${catFilter} (${periodLabel})`}
            </p>
            <p className="text-xl font-bold text-red-700">{fmt(total)}</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">By Category</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${catColors[cat] ?? "bg-slate-100 text-slate-600"}`}>
                {cat} <span className="font-semibold">{fmt(amt)}</span>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 && (
              <p className="text-xs text-slate-400">No expenses recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Date + Category filters */}
      <div className="px-6 pb-2 flex flex-wrap gap-2 items-center">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
        />
      </div>
      <div className="px-6 pb-3 flex gap-2 flex-wrap">
        {["All", ...expenseCategories].map((c) => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              catFilter === c
                ? "bg-[#2E7D32] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:text-[#2E7D32]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 px-6 pb-8 overflow-auto">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses found"
            description="Add your first expense to start tracking costs."
            action={
              <button onClick={openNew} className="px-4 py-2 bg-[#2E7D32] text-white text-sm rounded-lg">
                Add Expense
              </button>
            }
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["ID", "Category", "Description / Payee", "Amount", "Method", "Date", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-[#E8F5E9]/30 transition-colors cursor-pointer"
                    onClick={() => openEdit(e)}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{e.expenseId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catColors[e.category] ?? "bg-slate-100 text-slate-600"}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#0D1F0E] font-medium">{e.description || "—"}</div>
                      {e.payee && <div className="text-xs text-slate-400">{e.payee}</div>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-700 whitespace-nowrap">{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{e.paymentMethod || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{e.expenseDate}</td>
                    <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        onClick={() => deleteExpense(e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#0D1F0E]">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {editTarget ? `Edit ${editTarget.expenseId}` : "Add Expense"}
                </h2>
                <p className="text-xs text-white/60">
                  {editTarget ? "Update expense details" : "Record a new operating cost"}
                </p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category *">
                  <select
                    className={cls}
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {expenseCategories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Amount (AED) *">
                  <input
                    className={cls}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Date *">
                  <input
                    className={cls}
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  />
                </Field>
                <Field label="Payment Method">
                  <select
                    className={cls}
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {expensePaymentMethods.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Payee / Supplier">
                <input
                  className={cls}
                  value={form.payee}
                  onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
                  placeholder="Company or person"
                />
              </Field>

              <Field label="Description">
                <input
                  className={cls}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What was this expense for?"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  className={cls}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional details…"
                />
              </Field>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#2E7D32] text-white text-sm font-semibold rounded-lg hover:bg-[#1B5E20] transition disabled:opacity-50"
              >
                {saving ? "Saving…" : editTarget ? "Update Expense" : "Add Expense"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
