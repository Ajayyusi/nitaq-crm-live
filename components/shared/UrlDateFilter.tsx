"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import DateRangePicker from "./DateRangePicker";

export default function UrlDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const handleChange = useCallback(
    (newFrom: string, newTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newFrom) params.set("from", newFrom); else params.delete("from");
      if (newTo) params.set("to", newTo); else params.delete("to");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return <DateRangePicker from={from} to={to} onChange={handleChange} />;
}
