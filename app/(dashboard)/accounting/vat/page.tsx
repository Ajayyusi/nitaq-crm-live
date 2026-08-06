"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, FileSearch, RefreshCw } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { exportCsv, fmtAED, fmtNum } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { getPresetRange } from "@/lib/dateRange";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { Select } from "@/components/ui/input";
import { Instrument } from "@/components/ui/instrument";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";

interface VatTx {
  date: string; jvNumber: string; sourceType: string; sourceNumber: string;
  description: string; party: string; kind: "Output" | "Input";
  taxableAmount: number; vatAmount: number; totalAmount: number;
}

export default function VatPage() {
  const [from, setFrom] = useState(() => getPresetRange("this-quarter").from);
  const [to, setTo] = useState(() => getPresetRange("this-quarter").to);
  const [data, setData] = useState<{ outputVat: number; inputVat: number; netVat: number; vatRate: number; vatEnabled: boolean; transactions: VatTx[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [kindFilter, setKindFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/accounting/vat-report?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  const txns = (data?.transactions ?? []).filter((t) => !kindFilter || t.kind === kindFilter);
  const { slice, page, pages, setPage, total: pageTotal } = usePagination(txns, 50);

  const doExport = () => {
    exportCsv(
      `vat-report-${from}-${to}.csv`,
      ["Date", "Voucher", "Source", "Doc No", "Type", "Party", "Description", "Taxable", "VAT", "Total"],
      txns.map((t) => [t.date, t.jvNumber, t.sourceType, t.sourceNumber, t.kind, t.party, t.description, t.taxableAmount, t.vatAmount, t.totalAmount])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="VAT Report"
        subtitle={`UAE VAT ${data?.vatRate ?? 5}%${data && !data.vatEnabled ? " · VAT posting currently disabled in settings" : ""}`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload VAT report">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="solid" onClick={doExport} disabled={txns.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(0); }} />
        <Select
          value={kindFilter}
          onChange={(e) => { setKindFilter(e.target.value); setPage(0); }}
          aria-label="VAT direction"
          className="w-44"
        >
          <option value="">Output + Input</option>
          <option value="Output">Output VAT</option>
          <option value="Input">Input VAT</option>
        </Select>
      </div>

      {loading || (!data && !loadFailed) ? (
        <TableShell><SkeletonRows rows={8} cols={6} /></TableShell>
      ) : loadFailed || !data ? (
        <LoadError message="Couldn't load the VAT report. Check your connection and retry." onRetry={load} />
      ) : (
        <>
          {/* Summary instruments */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Instrument label="Output VAT" value={fmtAED(data.outputVat)} tone="caution" sub="Charged on sales" />
            <Instrument label="Input VAT" value={fmtAED(data.inputVat)} tone="advisory" sub="Recoverable on purchases" />
            <Instrument
              label={data.netVat > 0 ? "Net VAT Payable" : "Net VAT Refundable"}
              value={fmtAED(Math.abs(data.netVat))}
              tone={data.netVat > 0 ? "alert" : "phos"}
              sub={data.netVat > 0 ? "Due to the FTA" : "Claimable from the FTA"}
            />
          </div>

          {/* Transactions */}
          {txns.length === 0 ? (
            <div className="face">
              <EmptyState
                icon={FileSearch}
                title="No VAT transactions in this period"
                description="Try a wider date range, or check that VAT posting is enabled in Accounting Settings."
              />
            </div>
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Doc</Th>
                    <Th>Type</Th>
                    <Th>Party</Th>
                    <Th numeric>Taxable</Th>
                    <Th numeric>VAT</Th>
                    <Th numeric>Total</Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((t, i) => (
                    <Tr key={`${page}-${i}`}>
                      <Td className="readout whitespace-nowrap text-xs text-dim" data-numeric>{t.date}</Td>
                      <Td className="whitespace-nowrap text-xs">
                        <span className="readout font-semibold text-phos" data-numeric>{t.jvNumber}</span>
                        {t.sourceNumber && <span className="text-faint"> · {t.sourceNumber}</span>}
                      </Td>
                      <Td>
                        <Lamp variant={t.kind === "Output" ? "caution" : "advisory"}>{t.kind}</Lamp>
                      </Td>
                      <Td className="max-w-[180px] truncate" title={t.party || t.description}>{t.party || t.description}</Td>
                      <Td numeric className="whitespace-nowrap">{fmtNum(t.taxableAmount)}</Td>
                      <Td numeric className="whitespace-nowrap font-semibold">{fmtNum(t.vatAmount)}</Td>
                      <Td numeric className="whitespace-nowrap">{fmtNum(t.totalAmount)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <TableFooter>
                <Pagination page={page} pages={pages} setPage={setPage} total={pageTotal} shown={slice.length} />
              </TableFooter>
            </TableShell>
          )}
        </>
      )}
    </div>
  );
}
