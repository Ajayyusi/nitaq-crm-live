"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronDown, ChevronLeft, ChevronUp, Loader2, Paperclip, Pencil,
  Plus, RefreshCw, Trash2, Upload, X,
} from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, fmtNum, jvStatusBadge, usePostingAccounts } from "@/components/accounting/shared";

interface JvLine { accountCode: string; accountName?: string; debit: number; credit: number; description?: string; }
interface Jv {
  id: string; jvNumber: string; date: string; description: string; reference: string;
  sourceType: string; sourceNumber: string; status: string;
  totalDebit: number; totalCredit: number; lines: JvLine[];
  createdBy: string; postedBy: string; reversedByEntryId: string;
  attachmentName: string;
}

type Mode = "journal" | "receipt" | "invoice" | "expense";

const MODE_LABELS: Record<Mode, string> = {
  journal: "Journal Voucher",
  receipt: "Receipt",
  invoice: "Sales Invoice",
  expense: "Expense",
};

export default function JournalPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canPost = role === "admin" || role === "accountant";

  const { accounts } = usePostingAccounts();
  // Account restrictions per the accountant's spec
  const currentAssetAccounts = accounts.filter((a) => a.type === "Asset" && a.subCategory === "CURRENT ASSETS");
  const arAccounts = accounts.filter((a) => a.mainAccount === "ACCOUNTS RECEIVABLES");
  const revenueAccounts = accounts.filter((a) => a.type === "Revenue");
  // Every expense account from the chart of accounts — shown in Expense mode
  const expenseAccounts = accounts.filter((a) => a.type === "Expense");

  const [entries, setEntries] = useState<Jv[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showReversed, setShowReversed] = useState(false);
  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPost, setImportPost] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("journal");
  // Debit / credit account lists per simple (non-journal) mode
  const debitAccounts = mode === "receipt" ? currentAssetAccounts : mode === "invoice" ? arAccounts : expenseAccounts;
  const creditAccounts = mode === "receipt" ? arAccounts : mode === "invoice" ? revenueAccounts : currentAssetAccounts;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actioning, setActioning] = useState("");

  // Shared form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<{ accountCode: string; debit: string; credit: string; description: string }[]>([
    { accountCode: "", debit: "", credit: "", description: "" },
    { accountCode: "", debit: "", credit: "", description: "" },
  ]);
  // Simple-mode state (receipt / invoice)
  const [simpleDebit, setSimpleDebit] = useState("");
  const [simpleCredit, setSimpleCredit] = useState("");
  const [simpleAmount, setSimpleAmount] = useState("");
  // Attachment
  const [attachment, setAttachment] = useState<{ name: string; mimeType: string; dataBase64: string } | null>(null);
  const [attachError, setAttachError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("sourceType", sourceFilter);
    if (showReversed) params.set("showReversed", "true");
    fetch(`/api/accounting/journal-entries?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter, showReversed]);

  const runImport = async () => {
    setImporting(true); setImportMsg("");
    try {
      // Parse pasted CSV (first line = header)
      const text = importText.trim();
      if (!text) throw new Error("Paste CSV rows first.");
      const linesArr = text.split(/\r?\n/).filter((l) => l.trim());
      const headers = linesArr[0].split(",").map((h) => h.trim());
      const rows = linesArr.slice(1).map((line) => {
        // simple CSV split respecting quotes
        const cells: string[] = [];
        let cur = "", inQ = false;
        for (const ch of line) {
          if (ch === '"') inQ = !inQ;
          else if (ch === "," && !inQ) { cells.push(cur); cur = ""; }
          else cur += ch;
        }
        cells.push(cur);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
        return row;
      });
      const res = await fetch("/api/accounting/journal-entries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, post: importPost }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      const failed = (d.results ?? []).filter((r: { error?: string }) => r.error);
      setImportMsg(d.message + (failed.length ? ` Errors: ${failed.map((f: { voucher: string; error: string }) => `${f.voucher} (${f.error})`).join("; ")}` : ""));
      if (d.created > 0) load();
    } catch (err) {
      setImportMsg((err as Error).message);
    } finally { setImporting(false); }
  };

  useEffect(load, [load]);

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription(""); setReference("");
    setLines([{ accountCode: "", debit: "", credit: "", description: "" }, { accountCode: "", debit: "", credit: "", description: "" }]);
    setSimpleDebit(""); setSimpleCredit(""); setSimpleAmount("");
    setAttachment(null); setAttachError("");
    setEditingId(null);
    setFormError("");
  };

  const openNew = (m: Mode) => { resetForm(); setMode(m); setDrawerOpen(true); };

  const openEdit = (e: Jv) => {
    resetForm();
    setMode("journal");
    setEditingId(e.id);
    setDate(e.date);
    setDescription(e.description);
    setReference(e.reference);
    setLines(e.lines.map((l) => ({
      accountCode: l.accountCode,
      debit: l.debit ? String(l.debit) : "",
      credit: l.credit ? String(l.credit) : "",
      description: l.description ?? "",
    })));
    setDrawerOpen(true);
  };

  /** "Edit" a POSTED entry: reverse it, then open a pre-filled copy to fix and repost. */
  const correctEntry = async (e: Jv) => {
    if (!confirm(`${e.jvNumber} is posted. Correcting will reverse it and open an editable copy. Continue?`)) return;
    setActioning(e.id + "reverse");
    try {
      const res = await fetch(`/api/accounting/journal-entries/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reverse", reason: "Corrected" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      load();
      // Open a fresh drawer pre-filled with the original lines
      openEdit({ ...e, id: "" } as Jv);
      setEditingId(null);
      setReference(`Correction of ${e.jvNumber}`);
    } catch (err) {
      alert((err as Error).message);
    } finally { setActioning(""); }
  };

  const onFile = (file: File | null) => {
    setAttachError("");
    if (!file) { setAttachment(null); return; }
    if (file.size > 1_000_000) { setAttachError("File too large — maximum 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.split(",")[1] ?? "";
      setAttachment({ name: file.name, mimeType: file.type || "application/octet-stream", dataBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

  const effectiveLines = mode === "journal"
    ? lines.filter((l) => l.accountCode && (Number(l.debit) || Number(l.credit)))
        .map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined }))
    : (simpleDebit && simpleCredit && Number(simpleAmount) > 0
        ? [
            { accountCode: simpleDebit, debit: Number(simpleAmount), credit: 0, description: description || undefined },
            { accountCode: simpleCredit, debit: 0, credit: Number(simpleAmount), description: description || undefined },
          ]
        : []);

  const totalDebit = effectiveLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = effectiveLines.reduce((s, l) => s + l.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const submit = async (post: boolean) => {
    setSaving(true); setFormError("");
    try {
      const payload: Record<string, unknown> = {
        date, description, reference, post,
        mode: mode === "journal" ? undefined : mode,
        lines: effectiveLines,
        attachment: attachment ?? undefined,
      };
      const url = editingId ? `/api/accounting/journal-entries/${editingId}` : "/api/accounting/journal-entries";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      // For an edited draft, optionally post it right away
      if (editingId && post) {
        await fetch(`/api/accounting/journal-entries/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "post" }),
        });
      }
      setDrawerOpen(false);
      resetForm();
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
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          {canPost && (
            <>
              <button onClick={() => openNew("receipt")} className="flex items-center gap-1.5 rounded-lg border border-[#2E7D32] px-3 py-2 text-sm font-semibold text-[#2E7D32] hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20">
                <Plus className="h-4 w-4" /> Receipt
              </button>
              <button onClick={() => openNew("invoice")} className="flex items-center gap-1.5 rounded-lg border border-[#2E7D32] px-3 py-2 text-sm font-semibold text-[#2E7D32] hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20">
                <Plus className="h-4 w-4" /> Sales Invoice
              </button>
              <button onClick={() => openNew("expense")} className="flex items-center gap-1.5 rounded-lg border border-[#2E7D32] px-3 py-2 text-sm font-semibold text-[#2E7D32] hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20">
                <Plus className="h-4 w-4" /> Expense
              </button>
              <button onClick={() => { setImportOpen(true); setImportMsg(""); }} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                <Upload className="h-4 w-4" /> Import
              </button>
              <button onClick={() => openNew("journal")} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
                <Plus className="h-4 w-4" /> New JV
              </button>
            </>
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
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          <input type="checkbox" checked={showReversed} onChange={(e) => setShowReversed(e.target.checked)} className="h-3.5 w-3.5 accent-[#2E7D32]" />
          Show Reversed
        </label>
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
                  {e.attachmentName && <Paperclip className="h-3.5 w-3.5 text-gray-400" />}
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
                      {e.attachmentName && (
                        <a href={`/api/accounting/journal-entries/${e.id}?attachment=1`}
                          className="inline-flex items-center gap-1 font-semibold text-[#2E7D32] hover:underline dark:text-green-400">
                          <Paperclip className="h-3 w-3" /> {e.attachmentName}
                        </a>
                      )}
                      <span className="flex-1" />
                      {canPost && e.status === "Draft" && (
                        <>
                          <button onClick={() => openEdit(e)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 font-semibold text-gray-600 dark:border-white/10 dark:text-gray-400">
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button onClick={() => action(e.id, "post")} disabled={!!actioning} className="rounded-lg bg-[#2E7D32] px-3 py-1 font-semibold text-white disabled:opacity-60">
                            {actioning === e.id + "post" ? "…" : "Post"}
                          </button>
                          <button onClick={() => action(e.id, "cancel")} disabled={!!actioning} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold text-gray-600 dark:border-white/10 dark:text-gray-400">Cancel JV</button>
                        </>
                      )}
                      {canPost && e.status === "Posted" && (
                        <>
                          <button onClick={() => correctEntry(e)} disabled={!!actioning} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 font-semibold text-gray-600 dark:border-white/10 dark:text-gray-400">
                            <Pencil className="h-3 w-3" /> Correct
                          </button>
                          <button onClick={() => action(e.id, "reverse")} disabled={!!actioning} className="rounded-lg border border-amber-300 px-3 py-1 font-semibold text-amber-700 dark:border-amber-700 dark:text-amber-400">
                            {actioning === e.id + "reverse" ? "…" : "Reverse (cancel)"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Draft JV" : `New ${MODE_LABELS[mode]}`}
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{formError}</p>}

              {mode === "receipt" && !editingId && (
                <p className="rounded-lg bg-[#E8F5E9] px-3 py-2 text-xs text-[#1B5E20] dark:bg-green-900/30 dark:text-green-300">
                  <strong>Receipt:</strong> money in — debit a cash/bank account, credit the student&apos;s receivable.
                </p>
              )}
              {mode === "invoice" && !editingId && (
                <p className="rounded-lg bg-[#E8F5E9] px-3 py-2 text-xs text-[#1B5E20] dark:bg-green-900/30 dark:text-green-300">
                  <strong>Sales Invoice:</strong> revenue recognised — debit the student&apos;s receivable, credit a revenue account.
                </p>
              )}
              {mode === "expense" && !editingId && (
                <p className="rounded-lg bg-[#E8F5E9] px-3 py-2 text-xs text-[#1B5E20] dark:bg-green-900/30 dark:text-green-300">
                  <strong>Expense:</strong> debit the expense account, credit the cash/bank paid from. All {expenseAccounts.length} expense accounts are available below.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-x">Date *</label><DatePicker value={date} onChange={setDate} required /></div>
                <div><label className="label-x">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} /></div>
              </div>
              <div><label className="label-x">Description *</label><input required value={description} onChange={(e) => setDescription(e.target.value)} className={inp} /></div>

              {mode !== "journal" ? (
                <div className="space-y-3">
                  <div>
                    <label className="label-x">
                      {mode === "receipt" ? "Debit — received into (current assets)" : mode === "invoice" ? "Debit — student receivable" : "Debit — expense account"} *
                    </label>
                    <AccountSelect
                      value={simpleDebit} onChange={setSimpleDebit}
                      accounts={debitAccounts}
                      placeholder={mode === "receipt" ? "Cash / Bank / POS…" : mode === "invoice" ? "Student account…" : "Expense account…"}
                    />
                  </div>
                  <div>
                    <label className="label-x">
                      {mode === "receipt" ? "Credit — student receivable" : mode === "invoice" ? "Credit — revenue account" : "Credit — paid from (cash/bank)"} *
                    </label>
                    <AccountSelect
                      value={simpleCredit} onChange={setSimpleCredit}
                      accounts={creditAccounts}
                      placeholder={mode === "receipt" ? "Student account…" : mode === "invoice" ? "Revenue account…" : "Cash / Bank / Petty Cash…"}
                    />
                  </div>
                  <div>
                    <label className="label-x">Amount (AED) *</label>
                    <input type="number" step="0.01" min="0.01" required value={simpleAmount} onChange={(e) => setSimpleAmount(e.target.value)} className={inp} />
                  </div>
                </div>
              ) : (
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
                </div>
              )}

              {/* Attachment (new entries only) */}
              {!editingId && (
                <div>
                  <label className="label-x">Supporting Document (optional, max 1 MB)</label>
                  <input type="file" accept="application/pdf,image/*"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#E8F5E9] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1B5E20]" />
                  {attachError && <p className="mt-1 text-xs text-red-600">{attachError}</p>}
                  {attachment && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Paperclip className="h-3 w-3" /> {attachment.name}</p>
                  )}
                </div>
              )}

              <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${balanced ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}>
                <span>Debit: {fmtNum(totalDebit)} · Credit: {fmtNum(totalCredit)}</span>
                <span>{balanced ? "✓ Balanced" : "Not balanced"}</span>
              </div>
            </div>
            <div className="flex gap-2 border-t border-gray-200 p-4 dark:border-white/10">
              <button onClick={() => submit(false)} disabled={saving || !description} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300">
                {editingId ? "Save Draft" : "Save as Draft"}
              </button>
              <button onClick={() => submit(true)} disabled={saving || !balanced || !description} className="flex-1 rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save & Post" : "Post Now"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Import drawer */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setImportOpen(false)} />
          <aside className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">Import Journal Vouchers</h2>
              <button onClick={() => setImportOpen(false)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-400">
                <p className="mb-1 font-semibold">Paste CSV with a header row. Columns:</p>
                <code className="block whitespace-pre-wrap break-all text-[11px]">Voucher,Date,Description,AccountCode,Debit,Credit</code>
                <p className="mt-2">Rows with the same <strong>Voucher</strong> value become one entry. Each voucher must balance (debits = credits). Accounts must exist as active posting accounts.</p>
              </div>
              {importMsg && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">{importMsg}</p>}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={12}
                placeholder={"Voucher,Date,Description,AccountCode,Debit,Credit\nV1,2026-01-05,Office rent,5010010035,5000,0\nV1,2026-01-05,Office rent,1010200001,0,5000"}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={importPost} onChange={(e) => setImportPost(e.target.checked)} className="h-4 w-4 accent-[#2E7D32]" />
                <span className="text-gray-700 dark:text-gray-300">Post immediately (otherwise saved as Draft)</span>
              </label>
            </div>
            <div className="border-t border-gray-200 p-4 dark:border-white/10">
              <button onClick={runImport} disabled={importing || !importText.trim()} className="w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-50">
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </aside>
        </div>
      )}

      <style>{`.label-x { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
