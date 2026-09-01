"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/* Spinners, skeletons and error surfaces — the system states.
   Skeletons are inset: a placeholder should read as an empty well waiting
   to be filled, not as a raised card that already holds something. */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge-strong border-t-accent",
        className
      )}
    />
  );
}

/** Full-area loading state with placard caption. */
export function PanelLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner className="h-6 w-6" />
      <span className="placard">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-neo-xs bg-well shadow-neo-inset-sm", className)} />;
}

/** Skeleton table rows while a list loads. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-5", c === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Honest failure surface with a retry — replaces silent catch-and-empty. */
export function LoadError({
  message = "Couldn't load this data.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-neo border border-danger/25 bg-[var(--danger-soft)] px-6 py-12 text-center shadow-neo-inset-sm",
        className
      )}
    >
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm font-semibold text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
