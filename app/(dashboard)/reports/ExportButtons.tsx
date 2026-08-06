"use client";

import { useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
      >
        <Download className="h-3.5 w-3.5" aria-hidden /> Excel / CSV
      </a>
      <Button variant="primary" size="sm" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" aria-hidden /> PDF / Print
      </Button>
    </div>
  );
}
