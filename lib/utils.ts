import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The one money formatter. Two decimals is the house rule — this is an
 * accounting product and "AED 2,500" next to "AED 2,500.00" reads as a bug.
 * Pass decimals: 0 only where digits must stay short, e.g. chart axis ticks.
 *
 * Negatives render as "-AED 40.00", sign ahead of the currency, so a column
 * of figures stays aligned on the numerals.
 */
export function formatAED(amount: number, { decimals = 2 }: { decimals?: number } = {}) {
  const n = Number.isFinite(amount) ? amount : 0;
  const body = Math.abs(n).toLocaleString("en-AE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? "-" : ""}AED ${body}`;
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

/**
 * RFC 4180 field escaping. A bare carriage return counts: Excel and Sheets
 * both treat a lone \r inside an unquoted field as a row break, which silently
 * corrupts every column after it.
 */
export function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Header row + data rows as one CSV string. Escaping is applied throughout. */
export function toCsv(headers: string[], rows: readonly unknown[][]) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ].join("\r\n");
}

/** UTF-8 BOM so Excel opens the file as Unicode instead of the local codepage. */
export const CSV_BOM = "﻿";

/** Browser-side CSV download. Client components only. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([CSV_BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
