import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * ENGAGE button grammar (Night Six-Pack):
 * - primary  = outlined phosphor; lights up solid on hover/press
 * - solid    = pre-lit phosphor (the one most-important action on a screen)
 * - secondary= STANDBY: outlined neutral
 * - danger   = alert red, outlined; lights on hover
 * - ghost    = bare, for icon actions and table rows
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-ctl text-xs font-bold uppercase tracking-[0.08em] transition-all duration-150 focus-visible:outline-none focus-visible:shadow-glow disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "border border-phos/60 bg-transparent text-phos hover:border-phos hover:bg-phos hover:text-phos-ink hover:shadow-glow active:translate-y-px",
        solid:
          "border border-transparent bg-phos text-phos-ink shadow-glow hover:bg-phos-bright active:translate-y-px",
        secondary:
          "border border-bezel-strong bg-transparent text-ink hover:bg-well active:translate-y-px",
        danger:
          "border border-alert/60 bg-transparent text-alert hover:border-alert hover:bg-alert hover:text-white active:translate-y-px",
        ghost: "border border-transparent text-dim hover:bg-well hover:text-ink",
        link: "border-none normal-case tracking-normal text-phos underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3",
        default: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "h-9 w-9 px-0",
        iconSm: "h-8 w-8 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
