"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Calendar, CheckCircle, CreditCard, Sparkles, X } from "lucide-react";

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

/** System alert raised by the app (teacher assigned, low hours, record edited…). */
type SystemItem = {
  id: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
};

type Data = {
  followUps: FollowUpItem[];
  payments: PaymentItem[];
  system: SystemItem[];
};

function timeAgo(iso: string) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const POLL_MS = 5 * 60 * 1000; // 5 minutes
const MUTE_KEY = "nitaq_notifications_muted";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function requestBrowserPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "nitaq-followup" });
  } catch {
    // silently ignore (e.g. service worker not registered)
  }
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data>({ followUps: [], payments: [], system: [] });
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MUTE_KEY) === "1";
  });
  const ref = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  async function load(notify = false) {
    setLoading(true);
    try {
      // Follow-ups / payments are sales+finance only; system alerts are for
      // every role. Any that the role can't read just come back empty.
      const [fuRes, payRes, sysRes] = await Promise.all([
        fetch("/api/follow-ups?view=today&status=Pending").then((r) => r.json()).catch(() => ({})),
        fetch("/api/payments?status=Overdue").then((r) => r.json()).catch(() => ({})),
        fetch("/api/notifications").then((r) => r.json()).catch(() => ({})),
      ]);
      const followUps: FollowUpItem[] = (fuRes.followUps ?? []).map((f: Record<string, unknown>) => ({
        id: f.id,
        contactName: f.contactName,
        type: f.type,
        course: f.course,
      }));
      const payments: PaymentItem[] = (payRes.payments ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        studentName: p.studentName,
        amount: p.amount,
        dueDate: p.dueDate,
      }));
      const system: SystemItem[] = (sysRes.notifications ?? []).map((n: Record<string, unknown>) => ({
        id: n.id, title: n.title, body: n.body, link: n.link,
        read: n.read, createdAt: n.createdAt,
      }));
      setData({ followUps, payments, system });

      // Browser notification when new items appear
      const unreadSystem = system.filter((s) => !s.read).length;
      const total = followUps.length + payments.length + unreadSystem;
      if (notify && !muted && total > prevCountRef.current && total > 0) {
        const parts: string[] = [];
        if (unreadSystem > 0) parts.push(`${unreadSystem} new alert${unreadSystem > 1 ? "s" : ""}`);
        if (followUps.length > 0) parts.push(`${followUps.length} follow-up${followUps.length > 1 ? "s" : ""} due today`);
        if (payments.length > 0) parts.push(`${payments.length} overdue payment${payments.length > 1 ? "s" : ""}`);
        sendBrowserNotification("Nitaq CRM Reminder", parts.join(" · "));
      }
      prevCountRef.current = total;
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  // Initial load + request browser permission
  useEffect(() => {
    requestBrowserPermission();
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic polling
  useEffect(() => {
    if (muted) return;
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  }

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

  const unreadSystem = data.system.filter((s) => !s.read).length;
  const total = data.followUps.length + data.payments.length + unreadSystem;

  /** Mark system alerts read (one, or all). */
  async function markRead(ids?: string[]) {
    setData((d) => ({
      ...d,
      system: d.system.map((s) => (!ids || ids.includes(s.id) ? { ...s, read: true } : s)),
    }));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
    } catch { /* optimistic — ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:border-slate-700 dark:bg-[#112013] dark:text-slate-300 dark:hover:border-[#2E7D32] dark:hover:bg-[#1a2e1b] dark:hover:text-[#4CAF50]"
      >
        {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {!muted && total > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2E7D32] ring-2 ring-white dark:ring-[#112013]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#112013]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0D1F0E] dark:text-[#e8f5e9]">Notifications</span>
              {total > 0 && !muted && (
                <span className="rounded-full bg-[#2E7D32] px-2 py-0.5 text-[10px] font-bold text-white">
                  {total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                title={muted ? "Unmute auto-reminders" : "Mute auto-reminders"}
                className={`grid h-7 w-7 place-items-center rounded-lg transition ${muted ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"}`}
              >
                {muted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Mute banner */}
          {muted && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
              Auto-reminders are muted. Click <BellOff className="inline h-3 w-3" /> to re-enable.
            </div>
          )}

          {/* Poll interval label */}
          {!muted && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800/50">
              Auto-checks every 5 min · browser alerts on
            </div>
          )}

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
                {data.system.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-4 pb-1 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Alerts</p>
                      {unreadSystem > 0 && (
                        <button onClick={() => markRead()} className="text-[10px] font-bold text-[#2E7D32] hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    {data.system.slice(0, 8).map((n) => {
                      const Row = (
                        <>
                          <div className={`mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full ${n.read ? "bg-slate-100 text-slate-400 dark:bg-slate-800" : "bg-[#E8F5E9] text-[#2E7D32] dark:bg-green-900/30 dark:text-green-400"}`}>
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm ${n.read ? "font-medium text-slate-500 dark:text-slate-400" : "font-semibold text-[#0D1F0E] dark:text-[#e8f5e9]"}`}>
                              {n.title}
                            </p>
                            {n.body && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.body}</p>}
                            <p className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#2E7D32]" />}
                        </>
                      );
                      const cls = "flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-[#E8F5E9]/60 dark:hover:bg-[#1a2e1b]";
                      return n.link ? (
                        <Link key={n.id} href={n.link} onClick={() => { markRead([n.id]); setOpen(false); }} className={cls}>
                          {Row}
                        </Link>
                      ) : (
                        <button key={n.id} onClick={() => markRead([n.id])} className={cls}>
                          {Row}
                        </button>
                      );
                    })}
                  </div>
                )}

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
                            {f.contactName}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {f.type}{f.course ? ` · ${f.course}` : ""}
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
                            {p.studentName}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {fmt(p.amount)}{p.dueDate ? ` · Due ${p.dueDate}` : ""}
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
