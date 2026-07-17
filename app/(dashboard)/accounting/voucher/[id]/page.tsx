"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Loader2, Paperclip, Pencil, Printer } from "lucide-react";
import { fmtNum, jvStatusBadge } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";

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

  useEffect(() => {
    fetch(`/api/accounting/journal-entries/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setV(d.entry))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  }
  if (notFound || !v) {
    return (
      <div className="p-6">
        <BackButton fallback="/accounting/journal" />
        <p className="mt-4 text-sm text-gray-500">Voucher not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-3xl">
      <div>
        <button onClick={goBack} className="no-print mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Back</button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{v.jvNumber}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${jvStatusBadge[v.status] ?? ""}`}>{v.status}</span>
          <span className="flex-1" />
          <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          {canEdit && v.status === "Draft" && (
            <Link href={`/accounting/journal?edit=${v.id}`}
              className="no-print inline-flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1B5E20]">
              <Pencil className="h-3.5 w-3.5" /> Edit JV
            </Link>
          )}
          {canEdit && v.status === "Posted" && (
            <Link href={`/accounting/journal?correct=${v.id}`}
              className="no-print inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300">
              <Pencil className="h-3.5 w-3.5" /> Edit / Correct
            </Link>
          )}
        </div>
      </div>

      {/* Header details */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-3">
        {[
          ["Date", v.date],
          ["Source", `${v.sourceType}${v.sourceNumber ? ` · ${v.sourceNumber}` : ""}`],
          ["Reference", v.reference || "—"],
          ["Created by", v.createdBy],
          ["Posted by", v.postedBy || "—"],
          ["Amount", fmtNum(v.totalDebit)],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{v.description}</p>

      {/* Reversal cross-links */}
      {v.reversedByEntryId && (
        <Link href={`/accounting/voucher/${v.reversedByEntryId}`} className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
          This voucher was reversed → view the reversal entry
        </Link>
      )}
      {v.reversesEntryId && (
        <Link href={`/accounting/voucher/${v.reversesEntryId}`} className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
          This is a reversal → view the original voucher
        </Link>
      )}

      {/* Lines */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-gray-500">Account</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-gray-500">Description</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Debit</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-gray-500">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {v.lines.map((l, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="px-3 py-2">
                    <Link href={`/accounting/ledger?account=${encodeURIComponent(l.accountCode)}`} className="hover:text-[#2E7D32] hover:underline dark:hover:text-green-400">
                      <span className="font-mono text-xs text-gray-400">{l.accountCode}</span>{" "}
                      <span className="text-gray-800 dark:text-gray-200">{l.accountName}</span>
                    </Link>
                    {(l.studentRef || l.supplierRef) && <span className="ml-1 text-[11px] text-gray-400">· {l.studentRef || l.supplierRef}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">{l.description ?? ""}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(l.debit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNum(l.credit)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold dark:border-white/20 dark:bg-white/5">
                <td className="px-3 py-2.5" colSpan={2}>Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(v.totalDebit)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(v.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {v.attachment?.name && (
        <a href={`/api/accounting/journal-entries/${v.id}?attachment=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#2E7D32] hover:bg-green-50 dark:border-white/10 dark:text-green-400">
          <Paperclip className="h-4 w-4" /> {v.attachment.name}
        </a>
      )}
    </div>
  );
}
