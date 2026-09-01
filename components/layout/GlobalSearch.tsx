"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";

interface Hit { type: string; title: string; subtitle: string; href: string }

/**
 * Global search palette. Opens with the header button or ⌘K / Ctrl-K,
 * searches students, leads, courses, trainers, vouchers, accounts and
 * receipts (whatever the signed-in role is allowed to see), and jumps
 * straight to the record. Arrow keys + Enter to navigate.
 */
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ⌘K / Ctrl-K to open, Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Never stack the palette over an open modal: a single Escape would
        // then close both and discard whatever the user was typing.
        const modalOpen = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (modalOpen && !open) return;
        e.preventDefault();
        setOpen((o) => !o);
      }
      // Only claim Escape while the palette is actually open, so it never
      // closes a dialog underneath it.
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(""); setHits([]); setActive(0); setFailed(false); }
  }, [open]);

  // Keep keyboard focus inside the palette while it is open
  useEffect(() => {
    if (!open) return;
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [open]);

  // Debounced search
  const search = useCallback((term: string) => {
    abortRef.current?.abort();
    if (term.trim().length < 2) { setHits([]); setLoading(false); setFailed(false); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setFailed(false);
    fetch(`/api/search?q=${encodeURIComponent(term.trim())}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setHits(d.hits ?? []); setActive(0); setLoading(false); })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return; // superseded by a newer keystroke
        setHits([]);
        setFailed(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  // Keep the active option visible while arrowing through results
  useEffect(() => {
    document.getElementById(`gs-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (hit: Hit) => { setOpen(false); router.push(hit.href); };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
  };

  // Group hits by type, preserving order
  const groups: { type: string; items: Hit[] }[] = [];
  for (const h of hits) {
    const g = groups.find((x) => x.type === h.type);
    if (g) g.items.push(h); else groups.push({ type: h.type, items: [h] });
  }
  let flatIndex = -1;

  const showList = q.trim().length >= 2 && !failed;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        title="Search (⌘K)"
        className="inline-flex h-10 w-10 items-center justify-center rounded-neo-sm bg-well text-dim shadow-neo-inset-sm transition-[box-shadow,color] duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto sm:gap-2 sm:px-3.5"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden text-xs font-medium text-dim sm:inline">Search…</span>
        <kbd className="hidden rounded-neo-xs bg-face px-1.5 py-0.5 font-mono text-[10px] text-faint shadow-neo-xs lg:inline">⌘K</kbd>
      </button>

      {/* Portaled to <body>: the header sets backdrop-filter, which makes it a
          containing block for fixed descendants, and its sticky wrapper caps
          z-index at 30 — an inline palette would anchor to the header and sit
          under the page content. */}
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]">
          <div className="fixed inset-0 bg-[rgba(27,36,48,0.45)] backdrop-blur-[3px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="relative w-full max-w-lg overflow-hidden rounded-neo border border-edge bg-raised shadow-neo-pop"
            style={{ animation: "power-on 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <div className="flex items-center gap-2.5 border-b border-edge px-5">
              <Search className="h-4 w-4 flex-shrink-0 text-faint" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search students, leads, courses, vouchers…"
                role="combobox"
                aria-expanded={showList && hits.length > 0}
                aria-controls="gs-listbox"
                aria-activedescendant={hits[active] ? `gs-option-${active}` : undefined}
                aria-autocomplete="list"
                aria-label="Search the CRM"
                autoComplete="off"
                spellCheck={false}
                className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
              />
              {loading && <Spinner />}
              <Button variant="ghost" size="iconSm" onClick={() => setOpen(false)} aria-label="Close search">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {failed ? (
                <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-ink">Search is unavailable right now.</p>
                  <p className="text-xs text-dim">Check your connection, then try again.</p>
                  <Button variant="secondary" size="sm" onClick={() => search(q)}>
                    Retry
                  </Button>
                </div>
              ) : q.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-xs text-faint">
                  Type at least 2 characters — search by name, phone, ID, voucher or account.
                </p>
              ) : !loading && hits.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-dim">No matches for “{q}”.</p>
              ) : (
                <div id="gs-listbox" role="listbox" aria-label="Search results">
                  {groups.map((g) => (
                    <div key={g.type} role="group" aria-label={g.type}>
                      <p className="placard px-4 pb-1 pt-3" role="presentation">{g.type}</p>
                      {g.items.map((h) => {
                        flatIndex++;
                        const idx = flatIndex;
                        return (
                          <button
                            key={`${h.type}-${idx}`}
                            id={`gs-option-${idx}`}
                            role="option"
                            aria-selected={idx === active}
                            onClick={() => go(h)}
                            onMouseEnter={() => setActive(idx)}
                            className={`flex w-full flex-col items-start border-l-2 px-4 py-2.5 text-left transition-colors ${
                              idx === active
                                ? "border-phos bg-well"
                                : "border-transparent hover:bg-well"
                            }`}
                          >
                            <span className="w-full truncate text-sm font-semibold text-ink">{h.title}</span>
                            <span className="w-full truncate text-xs text-dim">{h.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden items-center gap-3 border-t border-bezel px-4 py-2 text-[10px] text-faint sm:flex">
              <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
