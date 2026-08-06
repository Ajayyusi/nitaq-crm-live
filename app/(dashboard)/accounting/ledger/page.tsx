"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { AccountSelect, exportCsv, fmtNum, usePostingAccounts } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Instrument } from "@/components/ui/instrument";
import { TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination } from "@/components/ui/table";
import { PanelLoading, SkeletonRows, LoadError } from "@/components/ui/feedback";

interface LedgerRow {
  entryId: string; date: string; jvNumber: string; sourceType: string; sourceNumber: string;
  description: string; debit: number; credit: number; balance: number;
}

function LedgerInner() {
  const searchParams = useSearchParams();
  const { accounts } = usePostingAccounts();
  const [account, setAccount] = useState(searchParams.get("account") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [sourceType, setSourceType] = useState("");
  const [includeReversed, setIncludeReversed] = useState(false);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [accountInfo, setAccountInfo] = useState<{ code: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    if (!account) { setRows([]); setAccountInfo(null); return; }
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams({ account });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (sourceType) params.set("sourceType", sourceType);
    if (includeReversed) params.set("includeReversed", "true");
    fetch(`/api/accounting/ledger?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setAccountInfo(d.account ?? null); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [account, from, to, sourceType, includeReversed]);

  useEffect(load, [load]);

  const doExport = () => {
    exportCsv(
      `ledger-${account}.csv`,
      ["Date", "Voucher", "Source", "Source No", "Description", "Debit", "Credit", "Balance"],
      rows.map((r) => [r.date, r.jvNumber, r.sourceType, r.sourceNumber, r.description, r.debit, r.credit, r.balance])
    );
  };

  const { slice, page, pages, setPage, total } = usePagination(rows, 50);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const closing = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  return (
    <div className="p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="General Ledger"
        subtitle={accountInfo ? `${accountInfo.code} — ${accountInfo.name} (${accountInfo.type})` : "Per-account transactions with a running balance"}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh ledger">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <a
              href={`/api/accounting/gl-dump?format=csv${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Download className="h-4 w-4" /> GL Dump (Excel/CSV)
            </a>
            <Button variant="primary" onClick={doExport} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> This Account
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-80">
            <AccountSelect value={account} onChange={setAccount} accounts={accounts} placeholder="Choose an account…" />
          </div>
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <Select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            aria-label="Filter by source"
            className="w-auto"
          >
            <option value="">All Sources</option>
            {["JV", "Invoice", "Receipt", "Expense", "SupplierBill", "SupplierPayment", "Refund", "Reversal"].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-ctl border border-bezel-strong px-3 text-xs font-semibold text-dim">
            <input type="checkbox" checked={includeReversed} onChange={(e) => setIncludeReversed(e.target.checked)} className="h-3.5 w-3.5 accent-phos" />
            Show reversed
          </label>
        </div>

        {/* Account balance summary */}
        {account && rows.length > 0 && !loading && !loadError && (
          <div className="grid grid-cols-3 gap-3">
            <Instrument label="Total Debit" value={fmtNum(totalDebit)} />
            <Instrument label="Total Credit" value={fmtNum(totalCredit)} />
            <Instrument
              label="Current Balance"
              value={`${fmtNum(Math.abs(closing))} ${closing < 0 ? "Cr" : "Dr"}`}
              tone={closing < 0 ? "alert" : "phos"}
            />
          </div>
        )}

        {!account ? (
          <div className="face">
            <EmptyState
              icon={FileSpreadsheet}
              title="Choose an account"
              description="Pick an account above to view its ledger and running balance."
            />
          </div>
        ) : loading ? (
          <TableShell><SkeletonRows rows={8} cols={7} /></TableShell>
        ) : loadError ? (
          <LoadError message="Couldn't load this account's ledger." onRetry={load} />
        ) : rows.length === 0 ? (
          <div className="face">
            <EmptyState
              icon={FileSpreadsheet}
              title="No transactions"
              description="This account has no transactions for the selected period or filters."
            />
          </div>
        ) : (
          <TableShell>
            <Table>
              <THead>
                <tr>
                  <Th>Date</Th>
                  <Th>Voucher</Th>
                  <Th>Source</Th>
                  <Th>Description</Th>
                  <Th numeric>Debit</Th>
                  <Th numeric>Credit</Th>
                  <Th numeric>Balance</Th>
                </tr>
              </THead>
              <tbody>
                {slice.map((r, i) => (
                  <Tr key={`${r.entryId}-${i}`}>
                    <Td className="readout whitespace-nowrap text-xs text-dim" data-numeric>{r.date}</Td>
                    <Td className="whitespace-nowrap">
                      <Link href={`/accounting/voucher/${r.entryId}`}
                        className="readout text-xs font-semibold text-phos underline-offset-2 hover:underline">
                        {r.jvNumber}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-dim">{r.sourceType}{r.sourceNumber ? ` · ${r.sourceNumber}` : ""}</Td>
                    <Td className="max-w-[280px] truncate" title={r.description}>{r.description}</Td>
                    <Td numeric className="whitespace-nowrap">{fmtNum(r.debit)}</Td>
                    <Td numeric className="whitespace-nowrap">{fmtNum(r.credit)}</Td>
                    <Td numeric className={`whitespace-nowrap font-semibold ${r.balance < 0 ? "text-alert" : ""}`}>{fmtNum(r.balance)}</Td>
                  </Tr>
                ))}
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

export default function LedgerPage() {
  return (
    <Suspense fallback={<PanelLoading label="Loading ledger" />}>
      <LedgerInner />
    </Suspense>
  );
}
