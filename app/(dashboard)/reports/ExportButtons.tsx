"use client";

import { useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";

/** Download the report as Excel-compatible CSV, or print → save as PDF. */
export default function ExportButtons() {
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  return (
    <div className="flex gap-2 print:hidden">
      <a
        href={`/api/reports/export?${qs.toString()}`}
        className="flex items-center gap-1.5 rounded-lg border border-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-[#2E7D32] transition hover:bg-[#E8F5E9] dark:text-green-400 dark:hover:bg-green-900/20"
      >
        <Download className="h-3.5 w-3.5" /> Excel / CSV
      </a>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1B5E20]"
      >
        <Printer className="h-3.5 w-3.5" /> PDF / Print
      </button>
    </div>
  );
}
