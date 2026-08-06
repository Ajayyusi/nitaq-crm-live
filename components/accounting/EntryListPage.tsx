"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Download, Inbox, Plus, RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import DatePicker from "@/components/shared/DatePicker";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Drawer } from "@/components/ui/dialog";
import { usePagination, Pagination } from "@/components/ui/table";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";
import { AccountSelect, exportCsv, fmtNum, usePostingAccounts } from "@/components/accounting/shared";

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ debit?: string; credit?: string; amount?: string }>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [debitCode, setDebitCode] = useState("");
  const [creditCode, setCreditCode] = useState("");
  const [amount, setAmount] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    const params = new URLSearchParams({ sourceType, limit: "500" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/accounting/journal-entries?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [sourceType, from, to]);

  useEffect(load, [load]);

  const { slice, page, pages, setPage, total: pageTotal } = usePagination(entries, 50);

  const openCreate = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription(""); setReference(""); setDebitCode(""); setCreditCode(""); setAmount("");
    setFormError(""); setFieldErrors({}); setDrawerOpen(true);
  };

  const submitCreate = async (post: boolean) => {
    const errs: typeof fieldErrors = {};
    if (!debitCode) errs.debit = "Choose an account.";
    if (!creditCode) errs.credit = "Choose an account.";
    if (!(Number(amount) > 0)) errs.amount = "Enter an amount above zero.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true); setFormError("");
    try {
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
      setFormError((err as Error).message || "Couldn't save. Check the entries and try again.");
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

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title={title}
        subtitle={`${subtitle} · ${entries.length} records · total ${fmtNum(total)}`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload list">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="primary" onClick={doExport} disabled={entries.length === 0}>
              <Download className="h-4 w-4" /> Excel / CSV
            </Button>
            {createMode && canPost && (
              <Button variant="solid" onClick={openCreate}>
                <Plus className="h-4 w-4" /> New {title.slice(0, -1)}
              </Button>
            )}
          </>
        }
      />

      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />

      {loading ? (
        <div className="face"><SkeletonRows rows={6} cols={5} /></div>
      ) : loadFailed ? (
        <LoadError message={`Couldn't load ${title.toLowerCase()}. Check your connection and retry.`} onRetry={load} />
      ) : entries.length === 0 ? (
        <div className="face">
          <EmptyState
            icon={Inbox}
            title={`No ${title.toLowerCase()} in this period`}
            description="Try a wider date range, or record a new entry."
            action={
              createMode && canPost ? (
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> New {title.slice(0, -1)}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {slice.map((e) => {
              const open = expanded === e.id;
              const party = e.lines.find((l) => l.studentRef)?.studentRef ?? "";
              return (
                <div key={e.id} className="face overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : e.id)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-well"
                  >
                    <span className="readout text-xs font-bold text-phos" data-numeric>{e.sourceNumber || e.jvNumber}</span>
                    <span className="readout text-xs text-faint" data-numeric>{e.date}</span>
                    <StatusBadge status={e.status} />
                    {party && <span className="text-sm font-medium text-ink">{party}</span>}
                    <span className="min-w-0 flex-1 truncate text-xs text-dim" title={e.description}>{e.description}</span>
                    <span className="readout text-sm font-bold text-ink" data-numeric>{fmtNum(e.totalDebit)}</span>
                    {open ? <ChevronUp className="h-4 w-4 text-faint" aria-hidden /> : <ChevronDown className="h-4 w-4 text-faint" aria-hidden />}
                  </button>
                  {open && (
                    <div className="border-t border-bezel px-4 py-3">
                      <table className="min-w-full text-sm">
                        <tbody>
                          {e.lines.map((l, i) => (
                            <tr key={i} className="border-t border-bezel/60 first:border-0">
                              <td className="py-1.5 pr-3">
                                <span className="readout text-xs text-faint" data-numeric>{l.accountCode}</span>{" "}
                                <span className="text-dim">{l.accountName}</span>
                              </td>
                              <td className="readout py-1.5 pr-3 text-right" data-numeric>{fmtNum(l.debit)}</td>
                              <td className="readout py-1.5 text-right" data-numeric>{fmtNum(l.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
                        <span>JV {e.jvNumber}</span>
                        {e.reference && <span>Ref: {e.reference}</span>}
                        <span>by {e.createdBy}</span>
                        <Link href={`/accounting/voucher/${e.id}`} className="font-semibold text-phos underline-offset-4 hover:underline">Open voucher →</Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="face px-4 py-2.5 text-xs text-dim">
            <Pagination page={page} pages={pages} setPage={setPage} total={pageTotal} shown={slice.length} />
          </div>
        </>
      )}

      {/* Create drawer */}
      {createMode && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`New ${title.slice(0, -1)}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => submitCreate(false)} disabled={saving}>
                Save Draft
              </Button>
              <Button variant="solid" onClick={() => submitCreate(true)} disabled={saving}>
                {saving ? "Saving…" : "Post Now"}
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
            <p className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-xs text-advisory">
              {createMode === "receipt"
                ? "Receipt: money in — debit a cash/bank account, credit the student's receivable."
                : "Invoice: revenue recognised — debit the student's receivable, credit a revenue account."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <DatePicker value={date} onChange={setDate} required />
              </Field>
              <Field label="Reference">
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
            </div>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field
              label={createMode === "receipt" ? "Debit — received into (cash/bank)" : "Debit — student receivable"}
              required
              error={fieldErrors.debit}
            >
              <AccountSelect value={debitCode} onChange={(v) => { setDebitCode(v); setFieldErrors((f) => ({ ...f, debit: undefined })); }} accounts={debitAccounts}
                placeholder={createMode === "receipt" ? "Cash / Bank / POS…" : "Student account…"} />
            </Field>
            <Field
              label={createMode === "receipt" ? "Credit — student receivable" : "Credit — revenue account"}
              required
              error={fieldErrors.credit}
            >
              <AccountSelect value={creditCode} onChange={(v) => { setCreditCode(v); setFieldErrors((f) => ({ ...f, credit: undefined })); }} accounts={creditAccounts}
                placeholder={createMode === "receipt" ? "Student account…" : "Revenue account…"} />
            </Field>
            <Field label="Amount (AED)" required error={fieldErrors.amount}>
              <Input
                type="number" step="0.01" min="0.01" value={amount}
                onChange={(e) => { setAmount(e.target.value); setFieldErrors((f) => ({ ...f, amount: undefined })); }}
              />
            </Field>
          </div>
        </Drawer>
      )}
    </div>
  );
}
