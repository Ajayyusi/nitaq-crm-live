import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Button grammar (Soft Panel).
 *
 * Every pressable variant follows the same physical rule: raised at rest,
 * recessed while held. `active:shadow-neo-inset-sm` is what makes a control
 * feel like a button in this system, so it is on all of them.
 *
 *   primary   filled accent — the one committing action on a screen
 *   solid     alias of primary, kept so existing call sites keep working
 *   secondary raised neutral surface — the default for everything else
 *   ghost     no surface until hovered — table row actions, toolbars
 *   danger    filled red — destructive, and only ever destructive
 *   link      inline text action
 *
 * Sizes `icon` / `iconSm` give a square pad for icon-only buttons; prefer
 * <IconButton> below, which forces the accessible name they need.
 */
const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap",
    "rounded-neo-sm text-xs font-bold uppercase tracking-[0.06em]",
    "transition-[box-shadow,background-color,color,transform] duration-200 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-ink shadow-neo-xs hover:bg-accent-hover hover:shadow-neo-sm active:shadow-neo-inset-sm active:translate-y-px",
        solid:
          "bg-accent text-accent-ink shadow-neo-xs hover:bg-accent-hover hover:shadow-neo-sm active:shadow-neo-inset-sm active:translate-y-px",
        secondary:
          "bg-face text-ink shadow-neo-xs hover:text-accent hover:shadow-neo-sm active:shadow-neo-inset-sm active:translate-y-px",
        ghost:
          "bg-transparent text-dim shadow-none hover:bg-well hover:text-ink active:shadow-neo-inset-sm",
        danger:
          "bg-danger text-white shadow-neo-xs hover:brightness-110 hover:shadow-neo-sm active:shadow-neo-inset-sm active:translate-y-px",
        link: "border-none normal-case tracking-normal text-accent shadow-none underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3",
        default: "h-10 px-5",
        lg: "h-11 px-7 text-[13px]",
        icon: "h-10 w-10 px-0",
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

/**
 * Icon-only button. Enforces the accessible name a bare <Button size="icon">
 * cannot — an icon with no label is invisible to a screen reader.
 */
const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { label: string; small?: boolean }
>(({ label, small, variant = "ghost", className, children, ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    size={small ? "iconSm" : "icon"}
    aria-label={label}
    title={label}
    className={className}
    {...props}
  >
    {children}
  </Button>
));
IconButton.displayName = "IconButton";

export { Button, IconButton, buttonVariants };
