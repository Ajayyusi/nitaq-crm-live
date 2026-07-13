"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronLeft, ChevronUp, Download, Loader2, Plus, RefreshCw, X } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, exportCsv, fmtNum, jvStatusBadge, usePostingAccounts } from "@/components/accounting/shared";

interface JvLine { accountCode: string; accountName?: string; debit: number; credit: number; description?: string; studentRef?: string; }
interface Jv {
  id: string; jvNumber: string; date: string; description: string; reference: string;
  sourceType: string; sourceNumber: string; status: string;
  totalDebit: number; totalCredit: number; lines: JvLine[];
  createdBy: string; postedBy: string;
}

/**
 * Shared list page for Receipts / Invoices — journal entries of one source
 * type. When createMode is set, a "New Receipt / New Invoice" button opens a
 * quick posting drawer (money in for receipts, revenue for invoices), so
 * receipts/invoices can be created directly from their own page.
 */
export default function EntryListPage({
  sourceType, title, subtitle, createMode,
}: {
  sourceType: "Receipt" | "Invoice";
  title: string;
  subtitle: string;
  createMode?: "receipt" | "invoice";
}) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canPost = role === "admin" || role === "accountant";

  const { accounts } = usePostingAccounts();
  const currentAssetAccounts = accounts.filter((a) => a.type === "Asset" && a.subCategory === "CURRENT ASSETS");
  const arAccounts = accounts.filter((a) => a.mainAccount === "ACCOUNTS RECEIVABLES");
  const revenueAccounts = accounts.filter((a) => a.type === "Revenue");
  const debitAccounts = createMode === "receipt" ? currentAssetAccounts : arAccounts;
  const creditAccounts = createMode === "receipt" ? arAccounts : revenueAccounts;

  const [entries, setEntries] = useState<Jv[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [debitCode, setDebitCode] = useState("");
  const [creditCode, setCreditCode] = useState("");
  const [amount, setAmount] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ sourceType, limit: "500" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/accounting/journal-entries?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sourceType, from, to]);

  useEffect(load, [load]);

  const openCreate = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription(""); setReference(""); setDebitCode(""); setCreditCode(""); setAmount("");
    setFormError(""); setDrawerOpen(true);
  };

  const submitCreate = async (post: boolean) => {
    setSaving(true); setFormError("");
    try {
      if (!debitCode || !creditCode || !(Number(amount) > 0)) throw new Error("Fill both accounts and an amount.");
      const res = await fetch("/api/accounting/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, description: description || `${title.slice(0, -1)}`, reference, post,
          mode: createMode,
          lines: [
            { accountCode: debitCode, debit: Number(amount), credit: 0, description: description || undefined },
            { accountCode: creditCode, debit: 0, credit: Number(amount), description: description || undefined },
          ],
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setDrawerOpen(false);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally { setSaving(false); }
  };

  // Only active (non-reversed) entries by default; the API already hides reversed.
  const total = entries.filter((e) => e.status === "Posted").reduce((s, e) => s + e.totalDebit, 0);

  const doExport = () => {
    exportCsv(
      `${title.toLowerCase().replace(/\s+/g, "-")}-${from || "all"}-${to || "all"}.csv`,
      ["Date", "Voucher", "Doc No", "Status", "Party", "Description", "Amount"],
      entries.map((e) => [
        e.date, e.jvNumber, e.sourceNumber,
        e.status,
        e.lines.find((l) => l.studentRef)?.studentRef ?? "",
        e.description, e.totalDebit,
      ])
    );
  };

  const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle} · {entries.length} records · total {fmtNum(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={doExport} disabled={entries.length === 0} className="flex items-center gap-1.5 rounded-lg border border-[#2E7D32] px-3 py-2 text-sm font-semibold text-[#2E7D32] hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/20">
            <Download className="h-4 w-4" /> Excel / CSV
          </button>
          {createMode && canPost && (
            <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> New {title.slice(0, -1)}
            </button>
          )}
        </div>
      </div>

      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">
          No {title.toLowerCase()} in this period.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const open = expanded === e.id;
            const party = e.lines.find((l) => l.studentRef)?.studentRef ?? "";
            return (
              <div key={e.id} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <button onClick={() => setExpanded(open ? null : e.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left">
                  <span className="font-mono text-xs font-bold text-[#2E7D32] dark:text-green-400">{e.sourceNumber || e.jvNumber}</span>
                  <span className="text-xs text-gray-400">{e.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${jvStatusBadge[e.status] ?? ""}`}>{e.status}</span>
                  {party && <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{party}</span>}
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{e.description}</span>
                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmtNum(e.totalDebit)}</span>
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-4 py-3 dark:border-white/10">
                    <table className="min-w-full text-sm">
                      <tbody>
                        {e.lines.map((l, i) => (
                          <tr key={i} className="border-t border-gray-50 first:border-0 dark:border-white/5">
                            <td className="py-1.5 pr-3">
                              <span className="font-mono text-xs text-gray-400">{l.accountCode}</span>{" "}
                              <span className="text-gray-700 dark:text-gray-300">{l.accountName}</span>
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(l.debit)}</td>
                            <td className="py-1.5 text-right tabular-nums">{fmtNum(l.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span>JV {e.jvNumber}</span>
                      {e.reference && <span>Ref: {e.reference}</span>}
                      <span>by {e.createdBy}</span>
                      <Link href={`/accounting/voucher/${e.id}`} className="font-semibold text-[#2E7D32] hover:underline dark:text-green-400">Open voucher →</Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create drawer */}
      {drawerOpen && createMode && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">New {title.slice(0, -1)}</h2>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{formError}</p>}
              <p className="rounded-lg bg-[#E8F5E9] px-3 py-2 text-xs text-[#1B5E20] dark:bg-green-900/30 dark:text-green-300">
                {createMode === "receipt"
                  ? "Receipt: money in — debit a cash/bank account, credit the student's receivable."
                  : "Invoice: revenue recognised — debit the student's receivable, credit a revenue account."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lbl">Date *</label><DatePicker value={date} onChange={setDate} required /></div>
                <div><label className="lbl">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} /></div>
              </div>
              <div><label className="lbl">Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} className={inp} /></div>
              <div>
                <label className="lbl">{createMode === "receipt" ? "Debit — received into (cash/bank)" : "Debit — student receivable"} *</label>
                <AccountSelect value={debitCode} onChange={setDebitCode} accounts={debitAccounts}
                  placeholder={createMode === "receipt" ? "Cash / Bank / POS…" : "Student account…"} />
              </div>
              <div>
                <label className="lbl">{createMode === "receipt" ? "Credit — student receivable" : "Credit — revenue account"} *</label>
                <AccountSelect value={creditCode} onChange={setCreditCode} accounts={creditAccounts}
                  placeholder={createMode === "receipt" ? "Student account…" : "Revenue account…"} />
              </div>
              <div><label className="lbl">Amount (AED) *</label><input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-2 border-t border-gray-200 p-4 dark:border-white/10">
              <button onClick={() => submitCreate(false)} disabled={saving} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300">Save Draft</button>
              <button onClick={() => submitCreate(true)} disabled={saving} className="flex-1 rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">{saving ? "Saving…" : "Post Now"}</button>
            </div>
          </aside>
        </div>
      )}
      <style>{`.lbl { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
