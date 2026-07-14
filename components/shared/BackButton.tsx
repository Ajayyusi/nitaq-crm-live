"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * History-aware Back button. Returns the user to the exact previous page they
 * visited (following real browser history — e.g. Cash Ledger → General Ledger
 * → Voucher, Back goes to General Ledger, then Cash Ledger), falling back to a
 * sensible parent route on a direct visit with no history.
 */
export default function BackButton({
  fallback = "/accounting",
  label = "Back",
  className = "",
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className={`mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ${className}`}
    >
      <ChevronLeft className="h-3 w-3" /> {label}
    </button>
  );
}
