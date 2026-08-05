"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

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
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ⌘K / Ctrl-K to open, Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(""); setHits([]); setActive(0); }
  }, [open]);

  // Debounced search
  const search = useCallback((term: string) => {
    abortRef.current?.abort();
    if (term.trim().length < 2) { setHits([]); setLoading(false); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(term.trim())}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setHits(d.hits ?? []); setActive(0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        title="Search (⌘K)"
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:border-slate-700 dark:bg-[#112013] dark:text-slate-300 dark:hover:border-[#2E7D32] dark:hover:bg-[#1a2e1b] sm:h-10 sm:w-auto sm:gap-2 sm:px-3"
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-xs font-medium text-slate-400 sm:inline">Search…</span>
        <kbd className="hidden rounded border border-slate-200 px-1 text-[10px] text-slate-400 dark:border-slate-600 lg:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#112013]">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-700">
              <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search students, leads, courses, vouchers…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-xs text-slate-400">
                  Type at least 2 characters — search by name, phone, ID, voucher or account.
                </p>
              ) : !loading && hits.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No matches for “{q}”.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.type}>
                    <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{g.type}</p>
                    {g.items.map((h) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <button
                          key={`${h.type}-${idx}`}
                          onClick={() => go(h)}
                          onMouseEnter={() => setActive(idx)}
                          className={`flex w-full flex-col items-start px-4 py-2.5 text-left transition ${
                            idx === active ? "bg-[#E8F5E9] dark:bg-[#1a2e1b]" : "hover:bg-slate-50 dark:hover:bg-white/5"
                          }`}
                        >
                          <span className="truncate text-sm font-semibold text-[#0D1F0E] dark:text-[#e8f5e9]">{h.title}</span>
                          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{h.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="hidden items-center gap-3 border-t border-slate-200 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-700 sm:flex">
              <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
