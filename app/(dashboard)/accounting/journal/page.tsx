"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Calculator, ChevronDown, ChevronUp, Paperclip, Pencil, Plus, RefreshCw, Trash2, Upload, X,
} from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, fmtNum, usePostingAccounts } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { Drawer, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Textarea, Select, Field, SearchInput } from "@/components/ui/input";
import { TableFooter, usePagination, Pagination } from "@/components/ui/table";
import { PanelLoading, SkeletonRows, LoadError } from "@/components/ui/feedback";

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

function JournalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
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
  const [actionError, setActionError] = useState("");
  // Guarded confirmations (replace window.confirm)
  const [confirmCorrect, setConfirmCorrect] = useState<Jv | null>(null);
  const [confirmReverse, setConfirmReverse] = useState<string | null>(null);

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
    setLoadError(false);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("sourceType", sourceFilter);
    if (showReversed) params.set("showReversed", "true");
    fetch(`/api/accounting/journal-entries?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setLoadError(true))
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

  /**
   * "Edit" a POSTED entry: reverse it, then open a pre-filled copy to fix and
   * repost. The confirmation dialog gates this; doCorrect performs the exact
   * reverse-then-edit sequence.
   */
  const correctEntry = (e: Jv) => setConfirmCorrect(e);

  const doCorrect = async (e: Jv) => {
    setActioning(e.id + "reverse");
    setActionError("");
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
      setActionError((err as Error).message);
    } finally { setActioning(""); }
  };

  // Deep-link: open the edit/correct flow when arriving from a voucher page
  // (/accounting/journal?edit=<id> or ?correct=<id>).
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !canPost) return;
    const editId = searchParams.get("edit");
    const correctId = searchParams.get("correct");
    if (!editId && !correctId) return;
    deepLinkHandled.current = true;
    const id = editId || correctId!;
    fetch(`/api/accounting/journal-entries/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const e = d.entry;
        if (!e) return;
        const jv: Jv = {
          id: e.id ?? e._id,
          jvNumber: e.jvNumber, date: String(e.date).slice(0, 10),
          description: e.description, reference: e.reference ?? "",
          sourceType: e.sourceType, sourceNumber: e.sourceNumber ?? "",
          status: e.status, totalDebit: e.totalDebit, totalCredit: e.totalCredit,
          lines: e.lines ?? [], createdBy: e.createdBy ?? "", postedBy: e.postedBy ?? "",
          reversedByEntryId: "", attachmentName: "",
        };
        if (editId && jv.status === "Draft") openEdit(jv);
        else if (correctId && jv.status === "Posted") correctEntry(jv);
      })
      .catch(() => {})
      .finally(() => router.replace("/accounting/journal"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canPost]);

  const onFile = (file: File | null) => {
    setAttachError("");
    if (!file) { setAttachment(null); return; }
    if (file.size > 1_000_000) { setAttachError("File too large — maximum 1 MB. Choose a smaller file."); return; }
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

  const doAction = async (id: string, act: "post" | "reverse" | "cancel") => {
    setActioning(id + act);
    setActionError("");
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
      setActionError((err as Error).message);
    } finally { setActioning(""); }
  };

  const action = (id: string, act: "post" | "reverse" | "cancel") => {
    if (act === "reverse") { setConfirmReverse(id); return; }
    doAction(id, act);
  };

  const q = search.trim().toLowerCase();
  const visibleEntries = q
    ? entries.filter((e) => e.jvNumber.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q) || (e.sourceNumber ?? "").toLowerCase().includes(q))
    : entries;

  const { slice, page, pages, setPage, total } = usePagination(visibleEntries, 50);

  const chip = (active: boolean) =>
    `h-8 rounded-ctl border px-3 text-xs font-semibold transition-colors ${
      active ? "border-phos bg-[var(--lamp-ok-bg)] text-phos" : "border-bezel-strong text-dim hover:bg-well"
    }`;

  return (
    <div className="p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Journal Vouchers"
        subtitle={`${entries.length} entries · auto + manual`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh journal entries">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canPost && (
              <>
                <Button variant="secondary" onClick={() => { setImportOpen(true); setImportMsg(""); }}>
                  <Upload className="h-4 w-4" /> Import
                </Button>
                <Button variant="solid" onClick={() => openNew("journal")}>
                  <Plus className="h-4 w-4" /> New JV
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search JV number or description…"
            aria-label="Search journal vouchers"
            className="w-full sm:w-64"
          />
          {["", "Draft", "Posted", "Reversed", "Cancelled"].map((s) => (
            <button key={s || "all"} type="button" onClick={() => setStatusFilter(s)} aria-pressed={statusFilter === s} className={chip(statusFilter === s)}>
              {s || "All Status"}
            </button>
          ))}
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filter by source"
            className="h-8 w-auto text-xs font-semibold"
          >
            <option value="">All Sources</option>
            {["JV", "Invoice", "Receipt", "Expense", "SupplierBill", "SupplierPayment", "Reversal"].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-ctl border border-bezel-strong px-3 text-xs font-semibold text-dim">
            <input type="checkbox" checked={showReversed} onChange={(e) => setShowReversed(e.target.checked)} className="h-3.5 w-3.5 accent-phos" />
            Show Reversed
          </label>
        </div>

        {actionError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")} aria-label="Dismiss error" className="flex-shrink-0 hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="face"><SkeletonRows rows={8} cols={5} /></div>
        ) : loadError ? (
          <LoadError message="Couldn't load journal entries." onRetry={load} />
        ) : visibleEntries.length === 0 ? (
          <div className="face">
            <EmptyState
              icon={Calculator}
              title="No journal entries"
              description={q || statusFilter || sourceFilter ? "Nothing matches the current filters." : "Manual and automatic vouchers will appear here."}
              action={canPost && !q && !statusFilter && !sourceFilter ? (
                <Button variant="primary" size="sm" onClick={() => openNew("journal")}>
                  <Plus className="h-4 w-4" /> New JV
                </Button>
              ) : undefined}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {slice.map((e) => {
                const open = expanded === e.id;
                return (
                  <div key={e.id} className="face overflow-hidden">
                    <button
                      onClick={() => setExpanded(open ? null : e.id)}
                      aria-expanded={open}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-well/40"
                    >
                      <span className="readout text-xs font-bold text-phos" data-numeric>{e.jvNumber}</span>
                      <span className="readout text-xs text-faint" data-numeric>{e.date}</span>
                      <StatusBadge status={e.status} />
                      <span className="rounded-lamp border border-bezel bg-well px-1.5 py-0.5 text-[10px] font-semibold text-dim">
                        {e.sourceType}{e.sourceNumber ? ` · ${e.sourceNumber}` : ""}
                      </span>
                      {e.attachmentName && <Paperclip aria-label="Has attachment" className="h-3.5 w-3.5 text-faint" />}
                      <span className="min-w-0 flex-1 truncate text-sm text-ink" title={e.description}>{e.description}</span>
                      <span className="readout text-sm font-bold text-ink" data-numeric>{fmtNum(e.totalDebit)}</span>
                      {open ? <ChevronUp aria-hidden className="h-4 w-4 text-faint" /> : <ChevronDown aria-hidden className="h-4 w-4 text-faint" />}
                    </button>
                    {open && (
                      <div className="border-t border-bezel px-4 py-3">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr>
                                <th className="placard py-1 pr-3 text-left">Account</th>
                                <th className="placard py-1 pr-3 text-left">Description</th>
                                <th className="placard py-1 pr-3 text-right">Debit</th>
                                <th className="placard py-1 text-right">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.lines.map((l, i) => (
                                <tr key={i} className="border-t border-bezel/60">
                                  <td className="py-1.5 pr-3">
                                    <span className="readout text-xs text-faint" data-numeric>{l.accountCode}</span>{" "}
                                    <span className="text-ink">{l.accountName}</span>
                                  </td>
                                  <td className="py-1.5 pr-3 text-xs text-dim">{l.description ?? ""}</td>
                                  <td className="readout py-1.5 pr-3 text-right" data-numeric>{fmtNum(l.debit)}</td>
                                  <td className="readout py-1.5 text-right" data-numeric>{fmtNum(l.credit)}</td>
                                </tr>
                              ))}
                              <tr className="border-t border-bezel font-bold">
                                <td className="py-1.5 pr-3 text-ink" colSpan={2}>Total</td>
                                <td className="readout py-1.5 pr-3 text-right text-ink" data-numeric>{fmtNum(e.totalDebit)}</td>
                                <td className="readout py-1.5 text-right text-ink" data-numeric>{fmtNum(e.totalCredit)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-faint">
                          <span>By {e.createdBy}</span>
                          {e.postedBy && <span>· Posted by {e.postedBy}</span>}
                          {e.attachmentName && (
                            <a href={`/api/accounting/journal-entries/${e.id}?attachment=1`}
                              className="inline-flex items-center gap-1 font-semibold text-phos underline-offset-2 hover:underline">
                              <Paperclip className="h-3 w-3" /> {e.attachmentName}
                            </a>
                          )}
                          <span className="flex-1" />
                          {canPost && e.status === "Draft" && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => openEdit(e)}>
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              <Button variant="primary" size="sm" onClick={() => action(e.id, "post")} disabled={!!actioning}>
                                {actioning === e.id + "post" ? "…" : "Post"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => action(e.id, "cancel")} disabled={!!actioning}>
                                Cancel JV
                              </Button>
                            </>
                          )}
                          {canPost && e.status === "Posted" && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => correctEntry(e)} disabled={!!actioning}>
                                <Pencil className="h-3 w-3" /> Correct
                              </Button>
                              <button
                                type="button"
                                onClick={() => action(e.id, "reverse")}
                                disabled={!!actioning}
                                className="inline-flex h-8 items-center gap-1 rounded-ctl border border-caution/60 px-3 text-xs font-bold uppercase tracking-[0.08em] text-caution transition-colors hover:bg-[var(--lamp-caution-bg)] disabled:pointer-events-none disabled:opacity-40"
                              >
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
            <div className="face">
              <TableFooter className="border-t-0">
                <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
              </TableFooter>
            </div>
          </>
        )}
      </div>

      {/* Editor drawer — guarded: backdrop clicks never discard the form */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Draft JV" : `New ${MODE_LABELS[mode]}`}
        size="xl"
        footer={
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => submit(false)} disabled={saving || !description}>
              {editingId ? "Save Draft" : "Save as Draft"}
            </Button>
            <Button variant="solid" className="flex-1" onClick={() => submit(true)} disabled={saving || !balanced || !description}>
              {saving ? "Saving…" : editingId ? "Save & Post" : "Post Now"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
              {formError}
            </p>
          )}

          {mode === "receipt" && !editingId && (
            <p className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-xs text-advisory">
              <strong>Receipt:</strong> money in — debit a cash/bank account, credit the student&apos;s receivable.
            </p>
          )}
          {mode === "invoice" && !editingId && (
            <p className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-xs text-advisory">
              <strong>Sales Invoice:</strong> revenue recognised — debit the student&apos;s receivable, credit a revenue account.
            </p>
          )}
          {mode === "expense" && !editingId && (
            <p className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-xs text-advisory">
              <strong>Expense:</strong> debit the expense account, credit the cash/bank paid from. All {expenseAccounts.length} expense accounts are available below.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <DatePicker value={date} onChange={setDate} required />
            </Field>
            <Field label="Reference" htmlFor="jv-ref">
              <Input id="jv-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>
          <Field label="Description" required help={!description ? "Required before saving." : undefined} htmlFor="jv-desc">
            <Input id="jv-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {mode !== "journal" ? (
            <div className="space-y-3">
              <Field
                label={mode === "receipt" ? "Debit — received into (current assets)" : mode === "invoice" ? "Debit — student receivable" : "Debit — expense account"}
                required
              >
                <AccountSelect
                  value={simpleDebit} onChange={setSimpleDebit}
                  accounts={debitAccounts}
                  placeholder={mode === "receipt" ? "Cash / Bank / POS…" : mode === "invoice" ? "Student account…" : "Expense account…"}
                />
              </Field>
              <Field
                label={mode === "receipt" ? "Credit — student receivable" : mode === "invoice" ? "Credit — revenue account" : "Credit — paid from (cash/bank)"}
                required
              >
                <AccountSelect
                  value={simpleCredit} onChange={setSimpleCredit}
                  accounts={creditAccounts}
                  placeholder={mode === "receipt" ? "Student account…" : mode === "invoice" ? "Revenue account…" : "Cash / Bank / Petty Cash…"}
                />
              </Field>
              <Field label="Amount (AED)" required htmlFor="jv-amount">
                <Input id="jv-amount" type="number" step="0.01" min="0.01" inputMode="decimal" value={simpleAmount} onChange={(e) => setSimpleAmount(e.target.value)} />
              </Field>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="placard">Lines</span>
                <Button variant="link" size="sm" type="button" onClick={() => setLines((ls) => [...ls, { accountCode: "", debit: "", credit: "", description: "" }])}>
                  <Plus className="h-3 w-3" /> Add Line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="rounded-ctl border border-bezel p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <AccountSelect value={l.accountCode} onChange={(v) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, accountCode: v } : x))} accounts={accounts} />
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Debit" aria-label={`Line ${i + 1} debit`} value={l.debit}
                            onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x))} />
                          <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Credit" aria-label={`Line ${i + 1} credit`} value={l.credit}
                            onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x))} />
                          <Input placeholder="Line note" aria-label={`Line ${i + 1} note`} value={l.description}
                            onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                        </div>
                      </div>
                      {lines.length > 2 && (
                        <Button variant="ghost" size="iconSm" type="button" className="mt-1 text-faint hover:text-alert"
                          onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachment (new entries only) */}
          {!editingId && (
            <Field label="Supporting Document" help="PDF or image, max 1 MB" error={attachError || undefined} htmlFor="jv-file">
              <input
                id="jv-file"
                type="file" accept="application/pdf,image/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-dim file:mr-3 file:rounded-ctl file:border-0 file:bg-well file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-phos"
              />
              {attachment && (
                <p className="mt-1 flex items-center gap-1 text-xs text-dim"><Paperclip className="h-3 w-3" /> {attachment.name}</p>
              )}
            </Field>
          )}

          <div
            role="status"
            className={`flex items-center justify-between gap-2 rounded-ctl border px-3 py-2 ${
              balanced ? "border-phos/30 bg-[var(--lamp-ok-bg)]" : "border-caution/30 bg-[var(--lamp-caution-bg)]"
            }`}
          >
            <span className="readout text-sm font-bold text-ink" data-numeric>
              Debit {fmtNum(totalDebit)} · Credit {fmtNum(totalCredit)}
            </span>
            <Lamp variant={balanced ? "ok" : "caution"}>{balanced ? "Balanced" : "Not balanced"}</Lamp>
          </div>
        </div>
      </Drawer>

      {/* Import drawer */}
      <Drawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Journal Vouchers"
        size="lg"
        footer={
          <Button variant="solid" className="w-full" onClick={runImport} disabled={importing || !importText.trim()}>
            {importing ? "Importing…" : "Import"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-ctl bg-well px-3 py-3 text-xs text-dim">
            <p className="mb-1 font-bold text-ink">Paste CSV with a header row. Columns:</p>
            <code className="readout block whitespace-pre-wrap break-all text-[11px]">Voucher,Date,Description,AccountCode,Debit,Credit</code>
            <p className="mt-2">Rows with the same <strong>Voucher</strong> value become one entry. Each voucher must balance (debits = credits). Accounts must exist as active posting accounts.</p>
          </div>
          {importMsg && (
            <p role="status" className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-sm text-advisory">
              {importMsg}
            </p>
          )}
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={12}
            aria-label="CSV rows to import"
            placeholder={"Voucher,Date,Description,AccountCode,Debit,Credit\nV1,2026-01-05,Office rent,5010010035,5000,0\nV1,2026-01-05,Office rent,1010200001,0,5000"}
            className="font-mono text-xs"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={importPost} onChange={(e) => setImportPost(e.target.checked)} className="h-4 w-4 accent-phos" />
            Post immediately (otherwise saved as Draft)
          </label>
        </div>
      </Drawer>

      {/* Correct: reverse the posted entry, then open an editable copy */}
      <ConfirmDialog
        open={!!confirmCorrect}
        onClose={() => setConfirmCorrect(null)}
        onConfirm={() => {
          const e = confirmCorrect!;
          setConfirmCorrect(null);
          doCorrect(e);
        }}
        title="Correct Posted Entry"
        message={confirmCorrect ? `${confirmCorrect.jvNumber} is posted. Correcting will reverse it and open an editable copy. Continue?` : ""}
        confirmLabel="Reverse & Edit"
        busy={!!actioning}
      />

      <ConfirmDialog
        open={!!confirmReverse}
        onClose={() => setConfirmReverse(null)}
        onConfirm={() => {
          const id = confirmReverse!;
          setConfirmReverse(null);
          doAction(id, "reverse");
        }}
        title="Reverse Entry"
        message="Create a reversal entry for this JV?"
        confirmLabel="Reverse"
        busy={!!actioning}
      />
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<PanelLoading label="Loading journal" />}>
      <JournalInner />
    </Suspense>
  );
}
