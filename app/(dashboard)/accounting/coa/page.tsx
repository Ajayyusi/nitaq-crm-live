"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, Loader2, Pencil, Plus, RefreshCw, Search, X } from "lucide-react";
import { fmtNum, type CoaAccount } from "@/components/accounting/shared";

const typeBadge: Record<string, string> = {
  Asset:     "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Liability: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Equity:    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Revenue:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Expense:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function CoaPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";

  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState<CoaAccount | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({ code: "", name: "", type: "Expense", parentCode: "", openingDebit: "", openingCredit: "" });
  const [editForm, setEditForm] = useState({ name: "", isActive: true, openingDebit: "", openingCredit: "" });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    fetch(`/api/accounting/accounts?${params}`)
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [typeFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          openingDebit: Number(form.openingDebit) || 0,
          openingCredit: Number(form.openingCredit) || 0,
          isPosting: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setAddOpen(false);
      setForm({ code: "", name: "", type: "Expense", parentCode: "", openingDebit: "", openingCredit: "" });
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally { setSaving(false); }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true); setFormError("");
    try {
      const res = await fetch(`/api/accounting/accounts/${encodeURIComponent(editing.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          isActive: editForm.isActive,
          openingDebit: Number(editForm.openingDebit) || 0,
          openingCredit: Number(editForm.openingCredit) || 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setEditing(null);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally { setSaving(false); }
  };

  const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{accounts.length} accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          {canEdit && (
            <button onClick={() => { setAddOpen(true); setFormError(""); }} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search code or name…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inp} pl-9`} />
        </div>
        {["", "Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => (
          <button key={t || "all"} onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === t ? "bg-[#2E7D32] text-white" : "border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"}`}>
            {t || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  {["Code", "Account Name", "Type", "Debit", "Credit", "Closing", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {accounts.map((a) => (
                  <tr key={a.code} className={`${!a.isPosting ? "bg-gray-50/70 dark:bg-white/[0.03]" : "hover:bg-gray-50 dark:hover:bg-white/5"} ${!a.isActive ? "opacity-50" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{a.code}</td>
                    <td className="px-3 py-2">
                      <span className={`${!a.isPosting ? "font-bold text-gray-800 dark:text-gray-200" : "text-gray-700 dark:text-gray-300"}`}>
                        {a.isPosting ? (
                          <Link href={`/accounting/ledger?account=${encodeURIComponent(a.code)}`} className="hover:text-[#2E7D32] hover:underline dark:hover:text-green-400">{a.name}</Link>
                        ) : a.name}
                      </span>
                      {!a.isActive && <span className="ml-2 text-[10px] font-bold text-red-400">INACTIVE</span>}
                    </td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadge[a.type] ?? ""}`}>{a.type}</span></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmtNum(a.openingDebit + a.currentDebit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmtNum(a.openingCredit + a.currentCredit)}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${a.closingBalance > 0 ? "text-gray-900 dark:text-white" : a.closingBalance < 0 ? "text-red-600 dark:text-red-400" : "text-gray-300"}`}>{fmtNum(a.closingBalance)}</td>
                    <td className="px-3 py-2 text-right">
                      {canEdit && a.isPosting && (
                        <button onClick={() => { setEditing(a); setEditForm({ name: a.name, isActive: a.isActive, openingDebit: String(a.openingDebit || ""), openingCredit: String(a.openingCredit || "") }); setFormError(""); }}
                          className="rounded p-1 text-gray-300 hover:text-[#2E7D32]"><Pencil className="h-3.5 w-3.5" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit drawer */}
      {(addOpen || editing) && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setAddOpen(false); setEditing(null); }} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">{editing ? `Edit ${editing.code}` : "Add Account"}</h2>
              <button onClick={() => { setAddOpen(false); setEditing(null); }} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <form onSubmit={editing ? saveEdit : saveNew} className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{formError}</p>}
              {!editing && (
                <>
                  <div><label className="label-x">Account Code *</label><input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. 5010010049" /></div>
                  <div><label className="label-x">Type *</label>
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inp}>
                      {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label-x">Parent Account Code</label><input value={form.parentCode} onChange={(e) => setForm((f) => ({ ...f, parentCode: e.target.value }))} className={inp} placeholder="optional, e.g. 5" /></div>
                </>
              )}
              <div><label className="label-x">Account Name *</label>
                <input required value={editing ? editForm.name : form.name}
                  onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-x">Opening Debit</label>
                  <input type="number" step="0.01" min="0" value={editing ? editForm.openingDebit : form.openingDebit}
                    onChange={(e) => editing ? setEditForm((f) => ({ ...f, openingDebit: e.target.value })) : setForm((f) => ({ ...f, openingDebit: e.target.value }))}
                    className={inp} />
                </div>
                <div><label className="label-x">Opening Credit</label>
                  <input type="number" step="0.01" min="0" value={editing ? editForm.openingCredit : form.openingCredit}
                    onChange={(e) => editing ? setEditForm((f) => ({ ...f, openingCredit: e.target.value })) : setForm((f) => ({ ...f, openingCredit: e.target.value }))}
                    className={inp} />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
                  <span className="text-gray-700 dark:text-gray-300">Active</span>
                </label>
              )}
              <button type="submit" disabled={saving} className="w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Account"}
              </button>
            </form>
          </aside>
        </div>
      )}
      <style>{`.label-x { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
