"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronLeft, ChevronUp, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, fmtNum, jvStatusBadge, usePostingAccounts } from "@/components/accounting/shared";

interface JvLine { accountCode: string; accountName?: string; debit: number; credit: number; description?: string; }
interface Jv {
  id: string; jvNumber: string; date: string; description: string; reference: string;
  sourceType: string; sourceNumber: string; status: string;
  totalDebit: number; totalCredit: number; lines: JvLine[];
  createdBy: string; postedBy: string; reversedByEntryId: string;
}

export default function JournalPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canPost = role === "admin" || role === "accountant";

  const { accounts } = usePostingAccounts();
  const [entries, setEntries] = useState<Jv[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actioning, setActioning] = useState("");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<{ accountCode: string; debit: string; credit: string; description: string }[]>([
    { accountCode: "", debit: "", credit: "", description: "" },
    { accountCode: "", debit: "", credit: "", description: "" },
  ]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("sourceType", sourceFilter);
    fetch(`/api/accounting/journal-entries?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter]);

  useEffect(load, [load]);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const submit = async (post: boolean) => {
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/accounting/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, description, reference, post,
          lines: lines
            .filter((l) => l.accountCode && (Number(l.debit) || Number(l.credit)))
            .map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setDrawerOpen(false);
      setDescription(""); setReference("");
      setLines([{ accountCode: "", debit: "", credit: "", description: "" }, { accountCode: "", debit: "", credit: "", description: "" }]);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally { setSaving(false); }
  };

  const action = async (id: string, act: "post" | "reverse" | "cancel") => {
    if (act === "reverse" && !confirm("Create a reversal entry for this JV?")) return;
    setActioning(id + act);
    try {
      const res = await fetch(`/api/accounting/journal-entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      load();
    } catch (err) {
      alert((err as Error).message);
    } finally { setActioning(""); }
  };

  const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Journal Vouchers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{entries.length} entries · auto + manual</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          {canPost && (
            <button onClick={() => { setDrawerOpen(true); setFormError(""); }} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> New JV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["", "Draft", "Posted", "Reversed", "Cancelled"].map((s) => (
          <button key={s || "all"} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === s ? "bg-[#2E7D32] text-white" : "border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"}`}>
            {s || "All Status"}
          </button>
        ))}
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          <option value="">All Sources</option>
          {["JV", "Invoice", "Receipt", "Expense", "SupplierBill", "SupplierPayment", "Reversal"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">No journal entries.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const open = expanded === e.id;
            return (
              <div key={e.id} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <button onClick={() => setExpanded(open ? null : e.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left">
                  <span className="font-mono text-xs font-bold text-[#2E7D32] dark:text-green-400">{e.jvNumber}</span>
                  <span className="text-xs text-gray-400">{e.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${jvStatusBadge[e.status] ?? ""}`}>{e.status}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">{e.sourceType}{e.sourceNumber ? ` · ${e.sourceNumber}` : ""}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{e.description}</span>
                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmtNum(e.totalDebit)}</span>
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-4 py-3 dark:border-white/10">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-bold uppercase text-gray-400">
                            <th className="py-1 pr-3">Account</th><th className="py-1 pr-3">Description</th>
                            <th className="py-1 pr-3 text-right">Debit</th><th className="py-1 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.lines.map((l, i) => (
                            <tr key={i} className="border-t border-gray-50 dark:border-white/5">
                              <td className="py-1.5 pr-3">
                                <span className="font-mono text-xs text-gray-400">{l.accountCode}</span>{" "}
                                <span className="text-gray-700 dark:text-gray-300">{l.accountName}</span>
                              </td>
                              <td className="py-1.5 pr-3 text-xs text-gray-400">{l.description ?? ""}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(l.debit)}</td>
                              <td className="py-1.5 text-right tabular-nums">{fmtNum(l.credit)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-gray-200 font-bold dark:border-white/10">
                            <td className="py-1.5 pr-3" colSpan={2}>Total</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(e.totalDebit)}</td>
                            <td className="py-1.5 text-right tabular-nums">{fmtNum(e.totalCredit)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>By {e.createdBy}</span>
                      {e.postedBy && <span>· Posted by {e.postedBy}</span>}
                      <span className="flex-1" />
                      {canPost && e.status === "Draft" && (
                        <>
                          <button onClick={() => action(e.id, "post")} disabled={!!actioning} className="rounded-lg bg-[#2E7D32] px-3 py-1 font-semibold text-white disabled:opacity-60">
                            {actioning === e.id + "post" ? "…" : "Post"}
                          </button>
                          <button onClick={() => action(e.id, "cancel")} disabled={!!actioning} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold text-gray-600 dark:border-white/10 dark:text-gray-400">Cancel JV</button>
                        </>
                      )}
                      {canPost && e.status === "Posted" && (
                        <button onClick={() => action(e.id, "reverse")} disabled={!!actioning} className="rounded-lg border border-amber-300 px-3 py-1 font-semibold text-amber-700 dark:border-amber-700 dark:text-amber-400">
                          {actioning === e.id + "reverse" ? "…" : "Reverse"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New JV drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">New Journal Voucher</h2>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{formError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-x">Date *</label><DatePicker value={date} onChange={setDate} required /></div>
                <div><label className="label-x">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} /></div>
              </div>
              <div><label className="label-x">Description *</label><input required value={description} onChange={(e) => setDescription(e.target.value)} className={inp} /></div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="label-x !mb-0">Lines</label>
                  <button type="button" onClick={() => setLines((ls) => [...ls, { accountCode: "", debit: "", credit: "", description: "" }])}
                    className="flex items-center gap-1 text-xs font-semibold text-[#2E7D32] hover:underline dark:text-green-400"><Plus className="h-3 w-3" /> Add Line</button>
                </div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 p-2.5 dark:border-white/10">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <AccountSelect value={l.accountCode} onChange={(v) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, accountCode: v } : x))} accounts={accounts} />
                          <div className="grid grid-cols-3 gap-2">
                            <input type="number" step="0.01" min="0" placeholder="Debit" value={l.debit}
                              onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x))} className={inp} />
                            <input type="number" step="0.01" min="0" placeholder="Credit" value={l.credit}
                              onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x))} className={inp} />
                            <input placeholder="Line note" value={l.description}
                              onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className={inp} />
                          </div>
                        </div>
                        {lines.length > 2 && (
                          <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="mt-1 rounded p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${balanced ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}>
                  <span>Debit: {fmtNum(totalDebit)} · Credit: {fmtNum(totalCredit)}</span>
                  <span>{balanced ? "✓ Balanced" : "Not balanced"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-gray-200 p-4 dark:border-white/10">
              <button onClick={() => submit(false)} disabled={saving || !description} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300">
                Save as Draft
              </button>
              <button onClick={() => submit(true)} disabled={saving || !balanced || !description} className="flex-1 rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
                {saving ? "Saving…" : "Post Now"}
              </button>
            </div>
          </aside>
        </div>
      )}
      <style>{`.label-x { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
