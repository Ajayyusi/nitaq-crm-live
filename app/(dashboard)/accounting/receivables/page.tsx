"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronRight, Download, RefreshCw, Users, Wand2 } from "lucide-react";
import { exportCsv, fmtNum } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { SearchInput } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Instrument } from "@/components/ui/instrument";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";

interface StudentRow {
  code: string; name: string; isControl: boolean;
  invoiced: number; paid: number; balance: number;
}

export default function ReceivablesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [totals, setTotals] = useState({ invoiced: 0, paid: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/accounting/receivables")
      .then((r) => r.json())
      .then((d) => { setStudents(d.students ?? []); setTotals(d.totals ?? { invoiced: 0, paid: 0, balance: 0 }); })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const migrate = async () => {
    setConfirmOpen(false);
    setMigrating(true); setMigrateMsg("");
    try {
      const res = await fetch("/api/accounting/receivables", { method: "POST" });
      const d = await res.json();
      setMigrateMsg(d.message ?? "Done.");
      load();
    } catch { setMigrateMsg("Migration failed. Retry, or contact your administrator."); }
    finally { setMigrating(false); }
  };

  const filtered = students.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.includes(search));
  const controlHasBalance = students.some((s) => s.isControl && (s.invoiced || s.paid));

  const { slice, page, pages, setPage, total: pageTotal } = usePagination(filtered, 50);

  const doExport = () => {
    exportCsv(
      "student-receivables.csv",
      ["Account Code", "Student", "Invoiced", "Paid", "Balance"],
      filtered.map((s) => [s.code, s.name, s.invoiced, s.paid, s.balance])
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Student Receivables"
        subtitle={`${filtered.length} students · outstanding ${fmtNum(totals.balance)}`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload receivables">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="solid" onClick={doExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Excel / CSV
            </Button>
          </>
        }
      />

      {/* Summary instruments */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Instrument label="Invoiced" value={fmtNum(totals.invoiced)} sub="Total fees billed" />
        <Instrument label="Collected" value={fmtNum(totals.paid)} tone="phos" sub="Payments received" />
        <Instrument
          label="Outstanding"
          value={fmtNum(totals.balance)}
          tone={totals.balance > 0 ? "alert" : "phos"}
          sub={totals.balance > 0 ? "Still to collect" : "Nothing outstanding"}
        />
      </div>

      {/* Migration notice: history still on the control account */}
      {canEdit && controlHasBalance && (
        <div className="rounded-card border border-advisory/30 bg-[var(--lamp-advisory-bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              Some history is still on the shared <strong>Student-1</strong> control account.
              Split it so every student has their own ledger.
            </p>
            <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)} disabled={migrating}>
              <Wand2 className="h-4 w-4" /> {migrating ? "Splitting…" : "Split by Student"}
            </Button>
          </div>
          {migrateMsg && <p role="status" className="mt-2 text-sm font-medium text-advisory">{migrateMsg}</p>}
        </div>
      )}
      {migrateMsg && !controlHasBalance && (
        <p role="status" className="rounded-ctl border border-phos/30 bg-[var(--lamp-ok-bg)] px-4 py-2 text-sm font-medium text-phos">{migrateMsg}</p>
      )}

      {/* Search */}
      <SearchInput
        placeholder="Search student…"
        aria-label="Search students"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="max-w-sm"
      />

      {/* Table */}
      {loading ? (
        <TableShell><SkeletonRows rows={8} cols={5} /></TableShell>
      ) : loadFailed ? (
        <LoadError message="Couldn't load student receivables. Check your connection and retry." onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="face">
          <EmptyState
            icon={Users}
            title={search ? "No students match this search" : "No student receivables yet"}
            description={search ? "Try a different name or account code." : "Balances appear here once invoices are posted."}
          />
        </div>
      ) : (
        <TableShell>
          <Table>
            <THead>
              <tr>
                <Th>Student</Th>
                <Th numeric>Invoiced</Th>
                <Th numeric>Paid</Th>
                <Th numeric>Balance</Th>
                <Th><span className="sr-only">Statement</span></Th>
              </tr>
            </THead>
            <tbody>
              {slice.map((s) => (
                <Tr key={s.code}>
                  <Td>
                    <Link href={`/accounting/ledger?account=${encodeURIComponent(s.code)}`} className="font-medium text-ink underline-offset-4 hover:text-phos hover:underline">
                      {s.name}
                    </Link>
                    {s.isControl && <Lamp variant="off" className="ml-2">Control</Lamp>}
                    <p className="readout text-[10px] text-faint" data-numeric>{s.code}</p>
                  </Td>
                  <Td numeric className="whitespace-nowrap text-dim">{fmtNum(s.invoiced)}</Td>
                  <Td numeric className="whitespace-nowrap text-phos">{fmtNum(s.paid)}</Td>
                  <Td numeric className={`whitespace-nowrap font-bold ${s.balance > 0 ? "text-alert" : s.balance < 0 ? "text-caution" : "text-faint"}`}>{fmtNum(s.balance)}</Td>
                  <Td className="text-right">
                    <Link href={`/accounting/ledger?account=${encodeURIComponent(s.code)}`}
                      className="inline-flex items-center gap-0.5 text-xs font-semibold text-phos underline-offset-4 hover:underline">
                      Statement <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Td>
                </Tr>
              ))}
              <tr className="border-t-2 border-bezel-strong bg-well font-bold">
                <Td className="placard">Total</Td>
                <Td numeric>{fmtNum(totals.invoiced)}</Td>
                <Td numeric className="text-phos">{fmtNum(totals.paid)}</Td>
                <Td numeric className={totals.balance > 0 ? "text-alert" : "text-faint"}>{fmtNum(totals.balance)}</Td>
                <Td />
              </tr>
            </tbody>
          </Table>
          <TableFooter>
            <Pagination page={page} pages={pages} setPage={setPage} total={pageTotal} shown={slice.length} />
          </TableFooter>
        </TableShell>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={migrate}
        title="Split control account by student"
        message="Move historical ledger lines from the Student-1 control account onto each student's own account? This rewrites how past entries are grouped."
        confirmLabel="Split by Student"
        danger={false}
        busy={migrating}
      />
    </div>
  );
}
