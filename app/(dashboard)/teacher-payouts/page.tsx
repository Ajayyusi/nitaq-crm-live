"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, usePostingAccounts } from "@/components/accounting/shared";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Drawer } from "@/components/ui/dialog";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";

interface PayLine {
  enrollmentRef: string; studentName: string; course: string;
  basis: string; rate: number; quantity: number; quantityLabel: string;
  sessionCount: number; hours: number; amount: number;
  source: "enrollment" | "teacher"; note?: string;
}
interface Due {
  teacherId: string; teacherName: string; paymentType: string;
  basis: string; rate: number; quantity: number; quantityLabel: string;
  sessionCount: number; totalHours: number; suggestedAmount: number;
  periodFrom: string; periodTo: string; note: string;
  lines: PayLine[]; mixed: boolean;
}
interface Payout {
  id: string; payoutNumber: string; teacherName: string; basis: string;
  quantity: number; sessionCount: number; totalHours: number; amount: number;
  paidDate: string; journalEntryId: string; createdBy: string;
}

const fmt = (n: number) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TeacherPayoutsPage() {
  const { accounts } = usePostingAccounts();
  const expenseAccounts = accounts.filter((a) => a.type === "Expense");
  const moneyAccounts = accounts.filter((a) => a.mainAccount === "CASH" || a.mainAccount === "BANKS");

  const [due, setDue] = useState<Due[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [target, setTarget] = useState<Due | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [expenseAccountCode, setExpenseAccountCode] = useState("");
  const [paymentAccountCode, setPaymentAccountCode] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/teacher-payouts")
      .then((r) => r.json())
      .then((d) => {
        setDue(d.due ?? []);
        setTotalDue(d.totalDue ?? 0);
        setPayouts(d.payouts ?? []);
        if (d.defaults) {
          setExpenseAccountCode((v) => v || d.defaults.expenseAccountCode || "");
          setPaymentAccountCode((v) => v || d.defaults.paymentAccountCode || "");
        }
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openPay = (d: Due) => {
    setTarget(d);
    setAmount(String(d.suggestedAmount));
    setPaidDate(new Date().toISOString().slice(0, 10));
    setReason(""); setNotes(""); setError("");
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/teacher-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: target.teacherId,
          amount: Number(amount) || 0,
          adjustmentReason: reason,
          paidDate, expenseAccountCode, paymentAccountCode, notes,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setNotice(d.warning ? `${d.payout.payoutNumber}: ${d.warning}` : `${d.payout.payoutNumber} recorded and posted to the ledger.`);
      setTarget(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  const adjusted = target && Math.abs((Number(amount) || 0) - target.suggestedAmount) > 0.009;
  const history = usePagination(payouts, 50);

  return (
    <div>
      <PageHeader
        title="Teacher Payouts"
        subtitle="What each teacher is owed for classes not yet paid"
        actions={
          <Button variant="secondary" size="icon" onClick={load} aria-label="Refresh payouts">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        }
      />

      <div className="space-y-4">
        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-card border border-phos/30 bg-[var(--lamp-ok-bg)] px-4 py-3 text-sm font-semibold text-phos"
          >
            <span>{notice}</span>
            <Button variant="ghost" size="iconSm" onClick={() => setNotice("")} aria-label="Dismiss notice">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}

        {/* Summary instruments */}
        <InstrumentRow className="md:grid-cols-3 xl:grid-cols-3">
          <Instrument label="Owed to Teachers" value={fmt(totalDue)} tone="phos" sub="Across all unpaid classes" />
          <Instrument label="Teachers Awaiting" value={due.length} sub="With unpaid sessions" />
          <Instrument
            label="Unpaid Hours"
            value={`${due.reduce((s, d) => s + d.totalHours, 0).toFixed(2)}h`}
            sub="Teaching time not yet paid"
          />
        </InstrumentRow>

        {/* Amounts due */}
        {loadFailed ? (
          <LoadError
            message="Couldn't load teacher payouts. Check your connection and retry."
            onRetry={load}
          />
        ) : loading ? (
          <TableShell>
            <SkeletonRows rows={5} cols={6} />
          </TableShell>
        ) : due.length === 0 ? (
          <TableShell>
            <EmptySettled />
          </TableShell>
        ) : (
          <TableShell>
            <Table className="min-w-[760px]">
              <THead>
                <tr>
                  <Th>Teacher</Th>
                  <Th>Basis</Th>
                  <Th>Unpaid Work</Th>
                  <Th>Period</Th>
                  <Th numeric>Amount Due</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </tr>
              </THead>
              <tbody>
                {due.map((d) => (
                  <Tr key={d.teacherId}>
                    <Td>
                      <p className="font-semibold">{d.teacherName}</p>
                      {d.note && (
                        <p className="mt-0.5 flex items-start gap-1 text-xs text-caution">
                          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
                          {d.note}
                        </p>
                      )}
                    </Td>
                    <Td className="text-dim">
                      {d.basis}
                      {d.rate > 0 && (
                        <span className="readout block text-xs text-faint" data-numeric>{fmt(d.rate)} each</span>
                      )}
                      {d.mixed && (
                        <span className="block text-xs text-faint">
                          {d.lines.length} registration{d.lines.length === 1 ? "" : "s"}, different rates
                        </span>
                      )}
                    </Td>
                    <Td>
                      <p className="text-dim">{d.quantityLabel}</p>
                      <p className="readout text-xs text-faint" data-numeric>
                        {d.sessionCount} session{d.sessionCount !== 1 ? "s" : ""} · {d.totalHours}h
                      </p>
                    </Td>
                    <Td className="readout whitespace-nowrap text-xs text-dim" data-numeric>
                      {d.periodFrom ? `${d.periodFrom} → ${d.periodTo}` : "—"}
                    </Td>
                    <Td numeric className="whitespace-nowrap font-bold text-phos">{fmt(d.suggestedAmount)}</Td>
                    <Td className="text-right">
                      <Button variant="primary" size="sm" onClick={() => openPay(d)}>
                        Mark Paid
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableShell>
        )}

        {/* Payment history */}
        {payouts.length > 0 && (
          <section aria-label="Payment history">
            <p className="placard mb-2">Payment History</p>
            <TableShell>
              <Table className="min-w-[720px]">
                <THead>
                  <tr>
                    <Th>Payout</Th>
                    <Th>Teacher</Th>
                    <Th>Work Covered</Th>
                    <Th>Paid Date</Th>
                    <Th numeric>Amount</Th>
                    <Th><span className="sr-only">Voucher</span></Th>
                  </tr>
                </THead>
                <tbody>
                  {history.slice.map((p) => (
                    <Tr key={p.id}>
                      <Td className="readout text-xs font-semibold text-phos" data-numeric>{p.payoutNumber}</Td>
                      <Td className="font-semibold">{p.teacherName}</Td>
                      <Td className="text-xs text-dim">
                        {p.basis} · {p.sessionCount} session{p.sessionCount !== 1 ? "s" : ""} · {p.totalHours}h
                      </Td>
                      <Td className="readout whitespace-nowrap text-xs text-dim" data-numeric>{p.paidDate}</Td>
                      <Td numeric className="whitespace-nowrap font-bold">{fmt(p.amount)}</Td>
                      <Td className="text-right">
                        {p.journalEntryId ? (
                          <a
                            href={`/accounting/voucher/${p.journalEntryId}`}
                            className="text-xs font-semibold text-phos underline-offset-4 hover:underline"
                          >
                            Voucher →
                          </a>
                        ) : (
                          <span className="text-xs text-alert">Not posted</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <TableFooter>
                <Pagination
                  page={history.page}
                  pages={history.pages}
                  setPage={history.setPage}
                  total={history.total}
                  shown={history.slice.length}
                />
              </TableFooter>
            </TableShell>
          </section>
        )}
      </div>

      {/* Mark paid drawer — posts to the ledger and locks sessions */}
      <Drawer
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `Pay ${target.teacherName}` : "Pay Teacher"}
        footer={
          target && (
            <>
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="solid"
                onClick={submit}
                disabled={saving || !(Number(amount) > 0) || (!!adjusted && reason.trim().length < 3)}
              >
                {saving ? "Recording…" : `Mark Paid · ${fmt(Number(amount) || 0)}`}
              </Button>
            </>
          )
        }
      >
        {target && (
          <div className="space-y-4">
            {error && (
              <p role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
                {error}
              </p>
            )}

            {/* Per-registration breakdown: a trainer can earn a different rate
                on each course, so the total is shown as its parts. */}
            {target.lines.length > 0 ? (
              <div className="overflow-hidden rounded-ctl border border-bezel bg-well text-sm">
                <ul className="divide-y divide-bezel">
                  {target.lines.map((l) => (
                    <li key={l.enrollmentRef || l.studentName} className="p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{l.studentName}</p>
                          <p className="truncate text-xs text-dim">
                            {l.course}
                            {l.enrollmentRef && (
                              <span className="readout text-faint"> · {l.enrollmentRef}</span>
                            )}
                          </p>
                        </div>
                        <span className="readout flex-shrink-0 font-bold text-ink" data-numeric>
                          {fmt(l.amount)}
                        </span>
                      </div>
                      <p className="readout mt-1 text-xs text-faint" data-numeric>
                        {l.quantityLabel} × {fmt(l.rate)} · {l.basis}
                        {l.source === "teacher" && " · trainer default"}
                      </p>
                      {l.note && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-caution">
                          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
                          {l.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between gap-2 border-t border-bezel bg-face px-3 py-2.5">
                  <span className="placard">Calculated total</span>
                  <span className="readout font-bold text-phos" data-numeric>{fmt(target.suggestedAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-ctl border border-bezel bg-well p-4 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-dim">Basis</span>
                  <span className="font-semibold text-ink">{target.basis}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-dim">Rate</span>
                  <span className="readout font-semibold text-ink" data-numeric>{fmt(target.rate)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-dim">Quantity</span>
                  <span className="font-semibold text-ink">{target.quantityLabel}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-dim">Sessions covered</span>
                  <span className="readout font-semibold text-ink" data-numeric>
                    {target.sessionCount} · {target.totalHours}h
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-2 border-t border-bezel pt-2">
                  <span className="placard">Calculated</span>
                  <span className="readout font-bold text-phos" data-numeric>{fmt(target.suggestedAmount)}</span>
                </div>
              </div>
            )}

            <Field
              label="Amount to Pay"
              required
              htmlFor="payout-amount"
              error={!(Number(amount) > 0) ? "Enter an amount greater than 0." : undefined}
            >
              <Input
                id="payout-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            {adjusted && (
              <Field
                label="Reason for the Different Amount"
                required
                htmlFor="payout-reason"
                error={
                  reason.length > 0 && reason.trim().length < 3
                    ? "Give a short reason so the adjustment is traceable."
                    : undefined
                }
                help={reason.length === 0 ? "Required because the amount differs from the calculated figure." : undefined}
              >
                <Input
                  id="payout-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. advance already given, bonus, deduction"
                />
              </Field>
            )}

            <Field label="Payment Date" required>
              <DatePicker value={paidDate} onChange={setPaidDate} required />
            </Field>

            <Field label="Expense Account (salary)">
              <AccountSelect
                value={expenseAccountCode}
                onChange={setExpenseAccountCode}
                accounts={expenseAccounts}
                placeholder="Salaries…"
              />
            </Field>

            <Field label="Paid From">
              <AccountSelect
                value={paymentAccountCode}
                onChange={setPaymentAccountCode}
                accounts={moneyAccounts.length ? moneyAccounts : accounts}
                placeholder="Cash / Bank…"
              />
            </Field>

            <Field label="Notes" htmlFor="payout-notes">
              <Input id="payout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <p className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-xs text-ink">
              Marking paid records the payment, locks these {target.sessionCount} session{target.sessionCount !== 1 ? "s" : ""} so they can&apos;t be paid twice,
              and posts the expense to the ledger.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/** Settled state for the dues list. */
function EmptySettled() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <CheckCircle2 className="h-8 w-8 text-phos" aria-hidden />
      <p className="text-sm font-bold text-ink">All teachers are settled</p>
      <p className="text-sm text-dim">No unpaid classes. New dues appear here after sessions are recorded.</p>
    </div>
  );
}
