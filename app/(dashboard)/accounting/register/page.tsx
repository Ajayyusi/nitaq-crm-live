"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, RefreshCw, SearchX } from "lucide-react";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { AccountSelect, exportCsv, fmtNum, usePostingAccounts } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { Select, SearchInput } from "@/components/ui/input";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { PanelLoading, SkeletonRows, LoadError } from "@/components/ui/feedback";

interface GlRow {
  date: string; jvNumber: string; status: string; sourceType: string; sourceNumber: string;
  reference: string; accountCode: string; accountName: string; description: string;
  debit: number; credit: number; student: string; supplier: string; course: string;
  createdBy: string; postedBy: string;
}

const SOURCE_TYPES = ["JV", "Invoice", "Receipt", "Expense", "SupplierBill", "SupplierPayment", "Advance", "Reversal", "Opening"];

function RegisterInner() {
  const params = useSearchParams();
  const { accounts } = usePostingAccounts();

  const [rows, setRows] = useState<GlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [sourceType, setSourceType] = useState(params.get("sourceType") ?? "");
  const [account, setAccount] = useState(params.get("account") ?? "");
  const [group, setGroup] = useState(params.get("group") ?? "");   // cash | bank | ""
  const [drcr, setDrcr] = useState("");                             // debit | credit | ""
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the free-text search — filtering runs over the full GL dump.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    fetch(`/api/accounting/gl-dump?${q}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  // Account groups for cash/bank drill-downs from the dashboard
  const groupCodes = useMemo(() => {
    if (!group) return null;
    const main = group === "cash" ? "CASH" : group === "bank" ? "BANKS" : "";
    return new Set(accounts.filter((a) => a.mainAccount === main).map((a) => a.code));
  }, [group, accounts]);

  const filtered = useMemo(() => {
    const s = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceType && r.sourceType !== sourceType) return false;
      if (account && r.accountCode !== account) return false;
      if (groupCodes && !groupCodes.has(r.accountCode)) return false;
      if (drcr === "debit" && !r.debit) return false;
      if (drcr === "credit" && !r.credit) return false;
      if (s && ![r.jvNumber, r.sourceNumber, r.reference, r.accountName, r.description, r.student, r.supplier, r.course]
        .some((v) => (v ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [rows, sourceType, account, groupCodes, drcr, debouncedSearch]);

  const { slice, page, pages, setPage, total: pageTotal } = usePagination(filtered, 100);

  const totalDebit = filtered.reduce((t, r) => t + r.debit, 0);
  const totalCredit = filtered.reduce((t, r) => t + r.credit, 0);

  const doExport = () => {
    exportCsv(
      `financial-register-${from || "all"}-${to || "all"}.csv`,
      ["Date", "Voucher", "Status", "Source", "Doc No", "Reference", "Account Code", "Account", "Description", "Debit", "Credit", "Student", "Supplier", "Course", "Created By", "Posted By"],
      filtered.map((r) => [r.date, r.jvNumber, r.status, r.sourceType, r.sourceNumber, r.reference, r.accountCode, r.accountName, r.description, r.debit, r.credit, r.student, r.supplier, r.course, r.createdBy, r.postedBy])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Financial Register"
        subtitle={`${filtered.length} of ${rows.length} lines · Dr ${fmtNum(totalDebit)} / Cr ${fmtNum(totalCredit)}`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload register">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="solid" onClick={doExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Excel / CSV
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="face flex flex-wrap items-center gap-2 p-3">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(0); }} />
        <Select value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(0); }} aria-label="Source type" className="w-auto">
          <option value="">All Types</option>
          {SOURCE_TYPES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={group} onChange={(e) => { setGroup(e.target.value); setAccount(""); setPage(0); }} aria-label="Account group" className="w-auto">
          <option value="">All Groups</option>
          <option value="cash">Cash accounts</option>
          <option value="bank">Bank accounts</option>
        </Select>
        <div className="w-56">
          <AccountSelect value={account} onChange={(v) => { setAccount(v); setGroup(""); setPage(0); }} accounts={accounts} placeholder="Any account" />
        </div>
        <Select value={drcr} onChange={(e) => { setDrcr(e.target.value); setPage(0); }} aria-label="Debit or credit" className="w-auto">
          <option value="">Debit + Credit</option>
          <option value="debit">Debits only</option>
          <option value="credit">Credits only</option>
        </Select>
        <SearchInput
          placeholder="Voucher no, name, description…"
          aria-label="Search register lines"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="min-w-[180px] flex-1"
        />
      </div>

      {/* Table */}
      {loading ? (
        <TableShell><SkeletonRows rows={10} cols={7} /></TableShell>
      ) : loadFailed ? (
        <LoadError message="Couldn't load the financial register. Check your connection and retry." onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="face">
          <EmptyState
            icon={SearchX}
            title="No lines match these filters"
            description="Widen the date range or clear a filter to see more of the ledger."
          />
        </div>
      ) : (
        <TableShell>
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Voucher</Th>
                <Th>Type</Th>
                <Th>Account</Th>
                <Th>Description</Th>
                <Th>Party</Th>
                <Th numeric>Debit</Th>
                <Th numeric>Credit</Th>
              </tr>
            </THead>
            <tbody>
              {slice.map((r, i) => (
                <Tr key={`${page}-${i}`}>
                  <Td className="readout whitespace-nowrap text-xs text-dim" data-numeric>{r.date}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    <span className="readout font-semibold text-phos" data-numeric>{r.jvNumber}</span>
                    {r.sourceNumber && <span className="text-faint"> · {r.sourceNumber}</span>}
                  </Td>
                  <Td className="whitespace-nowrap"><Lamp variant="off">{r.sourceType}</Lamp></Td>
                  <Td className="max-w-[200px] truncate" title={r.accountName}>
                    <Link href={`/accounting/ledger?account=${encodeURIComponent(r.accountCode)}`} className="text-ink underline-offset-4 hover:text-phos hover:underline">
                      {r.accountName}
                    </Link>
                  </Td>
                  <Td className="max-w-[240px] truncate text-xs text-dim" title={r.description}>{r.description}</Td>
                  <Td className="max-w-[140px] truncate text-xs text-dim" title={r.student || r.supplier || ""}>{r.student || r.supplier || ""}</Td>
                  <Td numeric className="whitespace-nowrap">{fmtNum(r.debit)}</Td>
                  <Td numeric className="whitespace-nowrap">{fmtNum(r.credit)}</Td>
                </Tr>
              ))}
              <tr className="border-t-2 border-bezel-strong bg-well font-bold">
                <Td colSpan={6} className="placard">Total · {filtered.length} lines</Td>
                <Td numeric>{fmtNum(totalDebit)}</Td>
                <Td numeric>{fmtNum(totalCredit)}</Td>
              </tr>
            </tbody>
          </Table>
          <TableFooter>
            <Pagination page={page} pages={pages} setPage={setPage} total={pageTotal} shown={slice.length} />
          </TableFooter>
        </TableShell>
      )}
    </div>
  );
}

export default function FinancialRegisterPage() {
  return (
    <Suspense fallback={<PanelLoading label="Loading register" />}>
      <RegisterInner />
    </Suspense>
  );
}
