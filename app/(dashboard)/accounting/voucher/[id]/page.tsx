"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, FileQuestion, Paperclip, Pencil, Printer } from "lucide-react";
import { fmtNum } from "@/components/accounting/shared";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { PanelLoading } from "@/components/ui/feedback";

interface JvLine {
  accountCode: string; accountName: string; debit: number; credit: number;
  description?: string; studentRef?: string; supplierRef?: string; courseRef?: string;
}
interface Voucher {
  id: string; jvNumber: string; date: string; description: string; reference: string;
  sourceType: string; sourceNumber: string; status: string;
  totalDebit: number; totalCredit: number; lines: JvLine[];
  createdBy: string; postedBy: string; postedAt: string;
  attachment?: { name: string };
  reversedByEntryId?: string; reversesEntryId?: string;
}

export default function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";
  const [v, setV] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Return to wherever the user came from (e.g. the General Ledger they were
  // viewing), falling back to the JV list on a direct visit.
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/accounting/journal");
  };

  const load = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/accounting/journal-entries/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setV(d.entry))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return <PanelLoading label="Loading voucher" />;
  }
  if (notFound || !v) {
    return (
      <div className="p-4 sm:p-6">
        <button
          type="button"
          onClick={goBack}
          className="mb-1 inline-flex items-center gap-1 text-xs text-dim transition-colors hover:text-ink"
        >
          <ChevronLeft className="h-3 w-3" aria-hidden /> Back
        </button>
        <div className="face mt-4">
          <EmptyState
            icon={FileQuestion}
            title="Voucher not found"
            description="It may have been deleted, or the link is wrong. Retry, or go back to the journal."
            action={
              <Button variant="secondary" size="sm" onClick={load}>
                Retry
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5 p-4 sm:p-6">
      {/* Printed vouchers stay black-on-white paper regardless of theme. */}
      <style>{`@media print {
        .print-area, .print-area * {
          background: #fff !important;
          color: #000 !important;
          border-color: #cfcfcf !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
      }`}</style>

      <div className="print-area space-y-5">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="no-print mb-1 inline-flex items-center gap-1 text-xs text-dim transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden /> Back
          </button>
          <div className="flex flex-wrap items-center gap-3 border-b border-bezel pb-4">
            <h1 className="readout text-lg font-bold tracking-tight text-ink" data-numeric>{v.jvNumber}</h1>
            <StatusBadge status={v.status} />
            <span className="flex-1" />
            <span className="no-print flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              {canEdit && v.status === "Draft" && (
                <Link
                  href={`/accounting/journal?edit=${v.id}`}
                  className="inline-flex h-8 select-none items-center justify-center gap-2 whitespace-nowrap rounded-ctl border border-transparent bg-phos px-3 text-xs font-bold uppercase tracking-[0.08em] text-phos-ink shadow-glow transition-all duration-150 hover:bg-phos-bright"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit JV
                </Link>
              )}
              {canEdit && v.status === "Posted" && (
                <Link
                  href={`/accounting/journal?correct=${v.id}`}
                  className="inline-flex h-8 select-none items-center justify-center gap-2 whitespace-nowrap rounded-ctl border border-bezel-strong px-3 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-all duration-150 hover:bg-well"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit / Correct
                </Link>
              )}
            </span>
          </div>
        </div>

        {/* Header details */}
        <div className="face grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          {[
            ["Date", v.date],
            ["Source", `${v.sourceType}${v.sourceNumber ? ` · ${v.sourceNumber}` : ""}`],
            ["Reference", v.reference || "—"],
            ["Created by", v.createdBy],
            ["Posted by", v.postedBy || "—"],
            ["Amount", fmtNum(v.totalDebit)],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="placard">{label}</p>
              <p className="text-sm font-medium text-ink">{value}</p>
            </div>
          ))}
        </div>

        {v.description && <p className="text-sm text-dim">{v.description}</p>}

        {/* Reversal cross-links */}
        {v.reversedByEntryId && (
          <Link
            href={`/accounting/voucher/${v.reversedByEntryId}`}
            className="block rounded-ctl border border-caution/30 bg-[var(--lamp-caution-bg)] px-4 py-2 text-sm font-medium text-caution underline-offset-4 hover:underline"
          >
            This voucher was reversed → view the reversal entry
          </Link>
        )}
        {v.reversesEntryId && (
          <Link
            href={`/accounting/voucher/${v.reversesEntryId}`}
            className="block rounded-ctl border border-caution/30 bg-[var(--lamp-caution-bg)] px-4 py-2 text-sm font-medium text-caution underline-offset-4 hover:underline"
          >
            This is a reversal → view the original voucher
          </Link>
        )}

        {/* Lines */}
        <div className="face overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-well">
                <tr>
                  <th className="placard border-b border-bezel px-3 py-2.5 text-left first:pl-4">Account</th>
                  <th className="placard border-b border-bezel px-3 py-2.5 text-left">Description</th>
                  <th className="placard border-b border-bezel px-3 py-2.5 text-right">Debit</th>
                  <th className="placard border-b border-bezel px-3 py-2.5 text-right last:pr-4">Credit</th>
                </tr>
              </thead>
              <tbody>
                {v.lines.map((l, i) => (
                  <tr key={i} className="border-b border-bezel/60">
                    <td className="px-3 py-2 pl-4">
                      <Link href={`/accounting/ledger?account=${encodeURIComponent(l.accountCode)}`} className="text-ink underline-offset-4 hover:text-phos hover:underline">
                        <span className="readout text-xs text-faint" data-numeric>{l.accountCode}</span>{" "}
                        {l.accountName}
                      </Link>
                      {(l.studentRef || l.supplierRef) && <span className="ml-1 text-[11px] text-faint">· {l.studentRef || l.supplierRef}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-dim">{l.description ?? ""}</td>
                    <td className="readout whitespace-nowrap px-3 py-2 text-right" data-numeric>{fmtNum(l.debit)}</td>
                    <td className="readout whitespace-nowrap px-3 py-2 pr-4 text-right" data-numeric>{fmtNum(l.credit)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-bezel-strong bg-well font-bold">
                  <td className="placard px-3 py-2.5 pl-4" colSpan={2}>Total</td>
                  <td className="readout px-3 py-2.5 text-right" data-numeric>{fmtNum(v.totalDebit)}</td>
                  <td className="readout px-3 py-2.5 pr-4 text-right" data-numeric>{fmtNum(v.totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {v.attachment?.name && (
        <a
          href={`/api/accounting/journal-entries/${v.id}?attachment=1`}
          className="inline-flex items-center gap-1.5 rounded-ctl border border-bezel-strong px-3 py-2 text-sm font-semibold text-phos transition-colors hover:bg-well"
        >
          <Paperclip className="h-4 w-4" aria-hidden /> {v.attachment.name}
        </a>
      )}
    </div>
  );
}
