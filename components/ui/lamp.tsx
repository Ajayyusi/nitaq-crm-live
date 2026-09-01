import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Status chip — the one place the neutral system gives way to colour.
 * A soft-tinted pill pressed slightly into its surface. Colour carries the
 * meaning and the label repeats it in words, so status never depends on hue
 * alone. Variant names are unchanged: ~40 call sites speak ok/caution/alert/
 * advisory/off.
 */
const lampVariants = cva(
  "inline-flex items-center gap-1 rounded-neo-xs border px-2 py-0.5 text-[10px] font-bold uppercase leading-4 tracking-[0.08em] shadow-neo-inset-sm",
  {
    variants: {
      variant: {
        ok: "border-ok/25 bg-[var(--ok-soft)] text-ok",
        caution: "border-warn/25 bg-[var(--warn-soft)] text-warn",
        alert: "border-danger/25 bg-[var(--danger-soft)] text-danger",
        advisory: "border-info/25 bg-[var(--info-soft)] text-info",
        off: "border-edge bg-[var(--lamp-off-bg)] text-dim",
      },
      pulse: {
        true: "animate-pulse",
        false: "",
      },
    },
    defaultVariants: { variant: "off", pulse: false },
  }
);

export interface LampProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof lampVariants> {}

export function Lamp({ className, variant, pulse, ...props }: LampProps) {
  return <span className={cn(lampVariants({ variant, pulse, className }))} {...props} />;
}

export type LampVariant = NonNullable<VariantProps<typeof lampVariants>["variant"]>;

export { lampVariants };
