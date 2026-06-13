"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import DateRangePicker from "./DateRangePicker";

interface Props {
  defaultFrom?: string;
  defaultTo?: string;
}

export default function UrlDateFilter({ defaultFrom = "", defaultTo = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Use URL param if present (even empty = "all time"), fall back to default only when absent
  const from = searchParams.has("from") ? (searchParams.get("from") ?? "") : defaultFrom;
  const to = searchParams.has("to") ? (searchParams.get("to") ?? "") : defaultTo;

  const handleChange = useCallback(
    (newFrom: string, newTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // Always set both so server can distinguish "explicitly all time" from "not set"
      params.set("from", newFrom);
      params.set("to", newTo);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return <DateRangePicker from={from} to={to} onChange={handleChange} />;
}
