import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Annunciator lamp — the status vocabulary of the panel.
 * A rectangular caps lamp that is either lit (ok / caution / alert /
 * advisory) or dim (off). Replaces every pastel status pill.
 */
const lampVariants = cva(
  "inline-flex items-center gap-1 rounded-lamp border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-4 tracking-[0.1em]",
  {
    variants: {
      variant: {
        ok: "border-phos/30 bg-[var(--lamp-ok-bg)] text-phos",
        caution: "border-caution/30 bg-[var(--lamp-caution-bg)] text-caution",
        alert: "border-alert/30 bg-[var(--lamp-alert-bg)] text-alert",
        advisory: "border-advisory/30 bg-[var(--lamp-advisory-bg)] text-advisory",
        off: "border-bezel bg-[var(--lamp-off-bg)] text-dim",
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
