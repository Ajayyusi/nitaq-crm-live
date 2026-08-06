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
      className={`mb-1 inline-flex items-center gap-1 rounded-ctl text-xs font-semibold text-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:shadow-glow ${className}`}
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {label}
    </button>
  );
}
