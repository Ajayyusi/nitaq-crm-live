"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Calendar, CheckCircle, CreditCard, X } from "lucide-react";

type FollowUpItem = {
  id: string;
  contactName: string;
  type: string;
  course: string;
};

type PaymentItem = {
  id: string;
  studentName: string;
  amount: number;
  dueDate: string;
};

type Data = {
  followUps: FollowUpItem[];
  payments: PaymentItem[];
};

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data>({ followUps: [], payments: [] });
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [fuRes, payRes] = await Promise.all([
        fetch("/api/follow-ups?view=today&status=Pending").then((r) => r.json()),
        fetch("/api/payments?status=Overdue").then((r) => r.json()),
      ]);
      setData({
        followUps: (fuRes.followUps ?? []).map((f: Record<string, unknown>) => ({
          id: f.id,
          contactName: f.contactName,
          type: f.type,
          course: f.course,
        })),
        payments: (payRes.payments ?? []).map((p: Record<string, unknown>) => ({
          id: p.id,
          studentName: p.studentName,
          amount: p.amount,
          dueDate: p.dueDate,
        })),
      });
    } catch {
      // silently ignore — badge just stays empty
    } finally {
      setLoading(false);
    }
  }

  // Initial load for the dot count
  useEffect(() => { load(); }, []);

  function toggle() {
    if (!open) load();
    setOpen((o) => !o);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const total = data.followUps.length + data.payments.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:border-slate-700 dark:bg-[#112013] dark:text-slate-300 dark:hover:border-[#2E7D32] dark:hover:bg-[#1a2e1b] dark:hover:text-[#4CAF50]"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2E7D32] ring-2 ring-white dark:ring-[#112013]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#112013]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0D1F0E] dark:text-[#e8f5e9]">Notifications</span>
              {total > 0 && (
                <span className="rounded-full bg-[#2E7D32] px-2 py-0.5 text-[10px] font-bold text-white">
                  {total}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2E7D32] border-t-transparent" />
              </div>
            ) : total === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <CheckCircle className="h-8 w-8 text-[#2E7D32]" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">All caught up!</p>
                <p className="text-xs text-slate-400">No pending follow-ups or overdue payments</p>
              </div>
            ) : (
              <>
                {data.followUps.length > 0 && (
                  <div>
                    <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Follow-ups Today
                    </p>
                    {data.followUps.slice(0, 6).map((f) => (
                      <Link
                        key={f.id}
                        href="/follow-ups"
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-[#E8F5E9]/60 dark:hover:bg-[#1a2e1b]"
                      >
                        <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#0D1F0E] dark:text-[#e8f5e9]">
                            {f.contactName as string}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {f.type as string}{f.course ? ` · ${f.course}` : ""}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {data.followUps.length > 6 && (
                      <p className="px-4 pb-1.5 text-xs text-slate-400">
                        +{data.followUps.length - 6} more
                      </p>
                    )}
                  </div>
                )}

                {data.payments.length > 0 && (
                  <div>
                    <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Overdue Payments
                    </p>
                    {data.payments.slice(0, 6).map((p) => (
                      <Link
                        key={p.id}
                        href="/payments?status=Overdue"
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-[#E8F5E9]/60 dark:hover:bg-[#1a2e1b]"
                      >
                        <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                          <CreditCard className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#0D1F0E] dark:text-[#e8f5e9]">
                            {p.studentName as string}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {fmt(p.amount as number)}
                            {p.dueDate ? ` · Due ${p.dueDate}` : ""}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {data.payments.length > 6 && (
                      <p className="px-4 pb-1.5 text-xs text-slate-400">
                        +{data.payments.length - 6} more
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <Link
              href="/follow-ups"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#2E7D32] hover:underline"
            >
              All follow-ups →
            </Link>
            <Link
              href="/payments?status=Overdue"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-rose-500 hover:underline"
            >
              Overdue payments →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
