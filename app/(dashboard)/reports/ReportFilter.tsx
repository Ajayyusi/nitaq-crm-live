"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DateRangePicker from "@/components/shared/DateRangePicker";

export default function ReportFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  return (
    <DateRangePicker
      from={from}
      to={to}
      onChange={(f, t) => {
        const p = new URLSearchParams();
        if (f) p.set("from", f);
        if (t) p.set("to", t);
        router.push(`/reports${p.size ? `?${p.toString()}` : ""}`);
      }}
    />
  );
}
