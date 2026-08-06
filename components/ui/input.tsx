"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/* Waypoint-entry inputs: sunken well, phosphor focus. */
const inputBase =
  "w-full rounded-ctl border border-bezel-strong bg-well px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-phos focus:outline-none focus:ring-2 focus:ring-phos/25 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputBase, "h-9", className)} {...props} />
  )
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, "min-h-20 py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(inputBase, "h-9 appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-1.5 block text-xs font-bold text-dim", className)}
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
          <span className="ml-0.5 text-alert" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-alert">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1 text-xs text-faint">{help}</p>
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
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    <input ref={ref} type="search" className={cn(inputBase, "h-9 pl-9")} {...props} />
  </div>
));
SearchInput.displayName = "SearchInput";

export { Input, Textarea, Select, Label, Field, SearchInput, inputBase };
