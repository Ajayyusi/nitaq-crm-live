"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Download, RefreshCw, Scale } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { exportCsv, fmtNum } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination } from "@/components/ui/table";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";

interface TbRow {
  code: string; name: string; type: string; category: string;
  openingDebit: number; openingCredit: number;
  periodDebit: number; periodCredit: number;
  closingDebit: number; closingCredit: number;
}
interface Totals {
  openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number;
  closingDebit: number; closingCredit: number; balanced: boolean;
}

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TbRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [openingImbalance, setOpeningImbalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (typeFilter) params.set("type", typeFilter);
    fetch(`/api/accounting/trial-balance?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotals(d.totals ?? null); setOpeningImbalance(d.openingImbalance ?? 0); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [from, to, typeFilter]);

  useEffect(load, [load]);

  const doExport = () => {
    exportCsv(
      `trial-balance-${from || "all"}-${to || "all"}.csv`,
      ["Code", "Account Name", "Type", "Opening Dr", "Opening Cr", "Period Dr", "Period Cr", "Closing Dr", "Closing Cr"],
      rows.map((r) => [r.code, r.name, r.type, r.openingDebit, r.openingCredit, r.periodDebit, r.periodCredit, r.closingDebit, r.closingCredit])
    );
  };

  const { slice, page, pages, setPage, total } = usePagination(rows, 100);

  const chip = (active: boolean) =>
    `h-8 rounded-ctl border px-3 text-xs font-semibold transition-colors ${
      active ? "border-phos bg-[var(--lamp-ok-bg)] text-phos" : "border-bezel-strong text-dim hover:bg-well"
    }`;

  return (
    <div className="p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Trial Balance"
        subtitle="Debits = credits check across every account"
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh trial balance">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="primary" onClick={doExport} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {totals && (
          <div role="status" className="flex flex-wrap items-center gap-2">
            <Lamp variant={totals.balanced ? "ok" : "alert"} pulse={!totals.balanced}>
              {totals.balanced ? "Balanced" : "Out of Balance"}
            </Lamp>
            <span className="readout text-xs text-dim" data-numeric>
              Dr {fmtNum(totals.periodDebit)} · Cr {fmtNum(totals.periodCredit)}
            </span>
          </div>
        )}

        {openingImbalance !== 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-card border border-caution/30 bg-[var(--lamp-caution-bg)] px-4 py-3 text-sm text-ink">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-caution" />
            <p>
              Opening balances entered on the Chart of Accounts don&apos;t balance (off by{" "}
              <span className="readout font-semibold text-caution" data-numeric>{fmtNum(Math.abs(openingImbalance))}</span>).
              Fix the opening debit/credit figures in the COA, or enter openings through a balanced Journal Voucher instead.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          {["", "Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => (
            <button key={t || "all"} type="button" onClick={() => setTypeFilter(t)} aria-pressed={typeFilter === t} className={chip(typeFilter === t)}>
              {t || "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <TableShell><SkeletonRows rows={10} cols={7} /></TableShell>
        ) : loadError ? (
          <LoadError message="Couldn't load the trial balance." onRetry={load} />
        ) : rows.length === 0 ? (
          <div className="face">
            <EmptyState
              icon={Scale}
              title="No balances in this period"
              description="Post journal entries, or widen the date range."
            />
          </div>
        ) : (
          <TableShell>
            <Table>
              <THead>
                <tr>
                  <Th>Account</Th>
                  <Th numeric>Open Dr</Th>
                  <Th numeric>Open Cr</Th>
                  <Th numeric>Period Dr</Th>
                  <Th numeric>Period Cr</Th>
                  <Th numeric>Close Dr</Th>
                  <Th numeric>Close Cr</Th>
                </tr>
              </THead>
              <tbody>
                {slice.map((r) => (
                  <Tr key={r.code}>
                    <Td>
                      <Link href={`/accounting/ledger?account=${encodeURIComponent(r.code)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                        className="underline-offset-2 hover:text-phos hover:underline">
                        <span className="readout text-xs text-faint" data-numeric>{r.code}</span>{" "}
                        <span>{r.name}</span>
                      </Link>
                    </Td>
                    {[r.openingDebit, r.openingCredit, r.periodDebit, r.periodCredit, r.closingDebit, r.closingCredit].map((v, i) => (
                      <Td key={i} numeric className="whitespace-nowrap text-dim">{fmtNum(v)}</Td>
                    ))}
                  </Tr>
                ))}
                {totals && (
                  <Tr className="border-t-2 border-bezel-strong bg-well font-bold">
                    <Td className="font-bold">Total{pages > 1 ? " (all accounts)" : ""}</Td>
                    {[totals.openingDebit, totals.openingCredit, totals.periodDebit, totals.periodCredit, totals.closingDebit, totals.closingCredit].map((v, i) => (
                      <Td key={i} numeric className="whitespace-nowrap font-bold">{fmtNum(v)}</Td>
                    ))}
                  </Tr>
                )}
              </tbody>
            </Table>
            <TableFooter>
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
            </TableFooter>
          </TableShell>
        )}
      </div>
    </div>
  );
}
