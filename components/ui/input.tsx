"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Inputs are pressed INTO the panel — the inverse of every button. The
 * hairline border stays: on a soft ground an inset shadow alone leaves the
 * field boundary ambiguous, which is the classic neomorphism accessibility
 * failure. Focus adds a solid accent ring that no shadow can swallow.
 */
const inputBase = [
  "w-full rounded-neo-sm border border-edge-strong bg-well px-3.5 text-sm text-ink",
  "shadow-neo-inset-sm placeholder:text-faint",
  "transition-[box-shadow,border-color] duration-200 ease-out",
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35",
  "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/30",
].join(" ");

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputBase, "h-10", className)} {...props} />
  )
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, "min-h-24 py-2.5", className)} {...props} />
));
Textarea.displayName = "Textarea";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(inputBase, "h-10 appearance-none pe-9", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-2 block text-xs font-semibold tracking-[0.01em] text-dim", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

/** Label + control + inline error/help. The standard form row. */
function Field({
  label,
  required,
  error,
  help,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-xs text-faint">{help}</p>
      ) : null}
    </div>
  );
}

/** Search input with leading icon. */
const SearchInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className={cn("relative", className)}>
    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    <input ref={ref} type="search" className={cn(inputBase, "h-10 ps-10")} {...props} />
  </div>
));
SearchInput.displayName = "SearchInput";

export { Input, Textarea, Select, Label, Field, SearchInput, inputBase };
