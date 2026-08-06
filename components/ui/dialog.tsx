"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/*
 * Dialog + Drawer — portaled, focus-trapped, ESC-closable, aria-correct.
 * Replaces the eight hand-rolled drawer/modal copies.
 * Backdrop click calls onClose; pass `guarded` to require explicit close
 * (unsaved forms must not be discarded by a stray click).
 */

function useDialogBehavior(open: boolean, onClose: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    // focus the panel (or its first focusable) on open
    const focusables = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusables?.[0] ?? node)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && node) {
        const items = Array.from(
          node.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);

  return ref;
}

function Backdrop({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  guarded = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** When true, backdrop click does NOT close (unsaved work). */
  guarded?: boolean;
}) {
  const ref = useDialogBehavior(open, onClose);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const width = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" }[size];

  return createPortal(
    <>
      <Backdrop onClick={guarded ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={cn(
            "animate-power-on w-full rounded-card border border-bezel bg-raised shadow-raise outline-none",
            width
          )}
          style={{ animation: "power-on 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-bezel px-5 py-3.5">
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close dialog">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-bezel px-5 py-3.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  guarded = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  /** Drawers usually hold forms — guarded by default. */
  guarded?: boolean;
}) {
  const ref = useDialogBehavior(open, onClose);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const width = { md: "max-w-md", lg: "max-w-xl", xl: "max-w-3xl" }[size];

  return createPortal(
    <>
      <Backdrop onClick={guarded ? undefined : onClose} />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s border-bezel bg-raised shadow-raise outline-none",
          width
        )}
        style={{ animation: "drawer-in 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <style>{`@keyframes drawer-in{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        <div className="flex items-center justify-between gap-3 border-b border-bezel px-5 py-4">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-bezel px-5 py-4">
            {footer}
          </div>
        )}
      </aside>
    </>,
    document.body
  );
}

/** Replaces window.confirm for destructive flows. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = true,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-dim">{message}</p>
    </Dialog>
  );
}
