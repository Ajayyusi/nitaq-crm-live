"use client";

import { useEffect, useRef, useState } from "react";
import { formatAED } from "@/lib/utils";

type Format = "integer" | "aed" | "aed2" | "percent";

const formatters: Record<Format, (n: number) => string> = {
  integer: (n) => Math.round(n).toLocaleString("en-AE"),
  // Matches the dashboard's whole-dirham figures
  aed: (n) =>
    "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  aed2: (n) => formatAED(n),
  percent: (n) => `${Math.round(n)}%`,
};

/** Fast start, soft landing — the figure settles rather than stopping dead. */
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A KPI figure that counts to its value, and from its old value to a new one
 * when filters change. Motion communicates magnitude and change; it never
 * delays reading: reduced-motion users get the final figure immediately, and
 * screen readers only ever hear the final figure.
 */
export default function CountUp({
  value,
  format = "integer",
  delay = 0,
  duration = 900,
}: {
  value: number;
  format?: Format;
  /** ms before counting starts — sync with the tile's entrance */
  delay?: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const from = previous.current ?? 0;
    previous.current = value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === value || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }

    setDisplay(from);
    let frame = 0;
    let start = 0;
    const timer = window.setTimeout(() => {
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        setDisplay(from + (value - from) * easeOutExpo(t));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay, duration]);

  const fmt = formatters[format];
  return (
    <>
      <span aria-hidden="true">{fmt(display)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </>
  );
}
