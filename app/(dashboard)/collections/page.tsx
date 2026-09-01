"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, MessageCircle, RefreshCw, Wallet } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Lamp } from "@/components/ui/lamp";
import { downloadCsv, formatAED, toCsv } from "@/lib/utils";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface Row {
  id: string; enrollmentId: string; fullName: string; phone: string; email: string;
  course: string; totalFee: number; amountPaid: number; balanceDue: number;
  paymentStatus: string; status: string; lastPaid: string;
  daysSince: number | null; isOverdue: boolean;
}
interface Totals { count: number; outstanding: number; overdueCount: number; overdueAmount: number }

const fmt = formatAED;

/** Polite, ready-to-send reminder. Staff can edit before sending in WhatsApp. */
function reminderText(r: Row) {
  return `Hello ${r.fullName}, this is Nitaq Academy. 😊
A friendly reminder about the outstanding balance for your ${r.course} course: ${fmt(r.balanceDue)}.
Paid so far: ${fmt(r.amountPaid)} of ${fmt(r.totalFee)}.
Please let us know if you'd like to arrange the payment or discuss an instalment plan. Thank you!`;
}

export default function CollectionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [chased, setChased] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotals(d.totals ?? null); })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = rows.filter((r) => {
    if (onlyOverdue && !r.isOverdue) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.fullName.toLowerCase().includes(q) || r.course.toLowerCase().includes(q) || r.phone.includes(q);
  });

  const { slice, page, pages, setPage, total } = usePagination(filtered, 50);

  const exportCsv = () => {
    const headers = ["Enrollment", "Student", "Phone", "Course", "Total Fee", "Paid", "Balance", "Payment Status", "Last Paid", "Days Since"];
    const csv = toCsv(headers, filtered.map((r) => [
      r.enrollmentId, r.fullName, r.phone, r.course, r.totalFee, r.amountPaid, r.balanceDue,
      r.paymentStatus, r.lastPaid, r.daysSince ?? "",
    ]));
    downloadCsv(`collections-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div>
      <PageHeader
        title="Money to Collect"
        subtitle="Outstanding balances, ordered by who to chase first"
        actions={
          <>
            <Button variant="secondary" size="icon" onClick={load} aria-label="Refresh list">
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="primary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" aria-hidden /> Export
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        {/* Summary instruments */}
        {totals && (
          <InstrumentRow className="xl:grid-cols-4">
            <Instrument label="Total Outstanding" value={fmt(totals.outstanding)} tone="phos" />
            <Instrument label="Students Owing" value={totals.count} />
            <Instrument
              label="Overdue Amount"
              value={fmt(totals.overdueAmount)}
              tone={totals.overdueCount > 0 ? "alert" : "ink"}
            />
            <Instrument
              label="Overdue Students"
              value={totals.overdueCount}
              tone={totals.overdueCount > 0 ? "alert" : "ink"}
            />
          </InstrumentRow>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search student, course or phone…"
            aria-label="Search outstanding balances"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <Button
            variant={onlyOverdue ? "solid" : "secondary"}
            size="sm"
            aria-pressed={onlyOverdue}
            onClick={() => setOnlyOverdue((v) => !v)}
          >
            Overdue Only
          </Button>
        </div>

        {/* List */}
        {loadFailed ? (
          <LoadError
            message="Couldn't load the collections list. Check your connection and retry."
            onRetry={load}
          />
        ) : loading ? (
          <TableShell>
            <SkeletonRows rows={6} cols={6} />
          </TableShell>
        ) : filtered.length === 0 ? (
          <TableShell>
            <EmptyState
              icon={Wallet}
              title={rows.length === 0 ? "Nothing outstanding" : "No matches"}
              description={
                rows.length === 0
                  ? "Everyone is paid up. New balances appear here as enrollments fall behind."
                  : "No students match the current search or filter."
              }
            />
          </TableShell>
        ) : (
          <TableShell>
            <Table className="min-w-[760px]">
              <THead>
                <tr>
                  <Th>Student</Th>
                  <Th>Course</Th>
                  <Th>Paid / Total</Th>
                  <Th numeric>Balance</Th>
                  <Th>Last Paid</Th>
                  <Th>Chase</Th>
                </tr>
              </THead>
              <tbody>
                {slice.map((r) => {
                  const waUrl = buildWhatsAppUrl(r.phone, reminderText(r));
                  const done = chased.has(r.id);
                  const paidPct = r.totalFee > 0 ? Math.min(100, Math.round((r.amountPaid / r.totalFee) * 100)) : 0;
                  return (
                    <Tr key={r.id} className={r.isOverdue ? "bg-[var(--lamp-alert-bg)]" : undefined}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.fullName}</span>
                          {r.isOverdue && <Lamp variant="alert">Overdue</Lamp>}
                        </div>
                        <p className="readout text-xs text-faint" data-numeric>
                          {r.enrollmentId}{r.phone ? ` · ${r.phone}` : ""}
                        </p>
                      </Td>
                      <Td className="max-w-[180px] truncate text-dim" title={r.course}>{r.course}</Td>
                      <Td>
                        <p className="readout text-xs text-dim" data-numeric>{fmt(r.amountPaid)} / {fmt(r.totalFee)}</p>
                        <div
                          role="progressbar"
                          aria-valuenow={paidPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${r.fullName} has paid ${paidPct}% of the total fee`}
                          className="mt-1 h-1.5 w-24 overflow-hidden rounded-sm bg-well"
                        >
                          <div className="h-full rounded-sm" style={{ width: `${paidPct}%`, background: "var(--chart-1)" }} />
                        </div>
                      </Td>
                      <Td numeric className="font-bold text-alert">{fmt(r.balanceDue)}</Td>
                      <Td className="text-xs text-dim">
                        {r.lastPaid || "Never"}
                        {r.daysSince !== null && (
                          <span className="readout block text-faint" data-numeric>{r.daysSince}d ago</span>
                        )}
                      </Td>
                      <Td>
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setChased((s) => new Set(s).add(r.id))}
                            aria-label={`Send WhatsApp payment reminder to ${r.fullName}`}
                            className={`inline-flex items-center gap-1.5 rounded-ctl border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                              done
                                ? "border-bezel-strong text-dim hover:bg-well"
                                : "border-phos/60 text-phos hover:bg-phos hover:text-phos-ink"
                            }`}
                          >
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {done ? "Sent" : "Remind"}
                          </a>
                        ) : (
                          <span className="text-xs text-faint">No phone</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <TableFooter>
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
              <span className="readout" data-numeric>
                {fmt(filtered.reduce((s, r) => s + r.balanceDue, 0))} outstanding
              </span>
            </TableFooter>
          </TableShell>
        )}
      </div>
    </div>
  );
}
