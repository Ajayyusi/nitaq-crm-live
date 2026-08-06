"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { Spinner } from "@/components/ui/feedback";

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
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MUTE_KEY) === "1";
  });
  const ref = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  async function load(notify = false) {
    setLoading(true);
    let failures = 0;
    const safeJson = (p: Promise<Response>) =>
      p.then((r) => r.json()).catch(() => { failures++; return {}; });
    try {
      // Follow-ups / payments are sales+finance only; system alerts are for
      // every role. Any that the role can't read just come back empty.
      const [fuRes, payRes, sysRes] = await Promise.all([
        safeJson(fetch("/api/follow-ups?view=today&status=Pending")),
        safeJson(fetch("/api/payments?status=Overdue")),
        safeJson(fetch("/api/notifications")),
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
      // Only an all-endpoints failure is a real outage; role-restricted
      // endpoints legitimately return empty payloads.
      setFailed(failures >= 3);

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
      setFailed(true);
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

  const rowCls =
    "flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-well";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Notifications (muted)" : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative grid h-10 w-10 place-items-center rounded-ctl border border-bezel-strong bg-face text-dim shadow-card transition-colors hover:border-phos hover:text-phos focus-visible:outline-none focus-visible:shadow-glow"
      >
        {muted ? <BellOff className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
        {!muted && total > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-lamp bg-phos shadow-glow" aria-hidden />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-card border border-bezel bg-raised shadow-raise"
          style={{ animation: "power-on 0.2s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-bezel px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink">Notifications</span>
              {total > 0 && !muted && (
                <Lamp variant="ok">
                  <span data-numeric>{total}</span>
                </Lamp>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="iconSm"
                onClick={toggleMute}
                title={muted ? "Unmute auto-reminders" : "Mute auto-reminders"}
                aria-label={muted ? "Unmute auto-reminders" : "Mute auto-reminders"}
              >
                {muted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Mute banner */}
          {muted && (
            <div className="border-b border-bezel bg-well px-4 py-2 text-xs text-dim">
              Auto-reminders are muted. Use the bell above to re-enable.
            </div>
          )}

          {/* Poll interval label */}
          {!muted && (
            <div className="border-b border-bezel bg-well px-4 py-1.5 text-[10px] text-faint">
              Auto-checks every 5 min · browser alerts on
            </div>
          )}

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner className="h-5 w-5" />
              </div>
            ) : failed && total === 0 ? (
              <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-ink">Couldn&apos;t check for notifications.</p>
                <p className="text-xs text-dim">Check your connection, then try again.</p>
                <Button variant="secondary" size="sm" onClick={() => load()}>
                  Retry
                </Button>
              </div>
            ) : total === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <CheckCircle className="h-8 w-8 text-phos" aria-hidden />
                <p className="text-sm font-semibold text-ink">All caught up</p>
                <p className="text-xs text-faint">No pending follow-ups or overdue payments</p>
              </div>
            ) : (
              <>
                {data.system.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-4 pb-1 pt-3">
                      <p className="placard">Alerts</p>
                      {unreadSystem > 0 && (
                        <button
                          onClick={() => markRead()}
                          className="text-[10px] font-bold uppercase tracking-[0.08em] text-phos hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {data.system.slice(0, 8).map((n) => {
                      const Row = (
                        <>
                          <Lamp variant={n.read ? "off" : "advisory"} className="mt-0.5 flex-shrink-0">
                            {n.read ? "Read" : "New"}
                          </Lamp>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm ${n.read ? "font-medium text-dim" : "font-semibold text-ink"}`}>
                              {n.title}
                            </p>
                            {n.body && <p className="truncate text-xs text-dim">{n.body}</p>}
                            <p className="text-[10px] text-faint">{timeAgo(n.createdAt)}</p>
                          </div>
                        </>
                      );
                      return n.link ? (
                        <Link key={n.id} href={n.link} onClick={() => { markRead([n.id]); setOpen(false); }} className={rowCls}>
                          {Row}
                        </Link>
                      ) : (
                        <button key={n.id} onClick={() => markRead([n.id])} className={rowCls}>
                          {Row}
                        </button>
                      );
                    })}
                  </div>
                )}

                {data.followUps.length > 0 && (
                  <div>
                    <p className="placard px-4 pb-1 pt-3">Follow-ups Today</p>
                    {data.followUps.slice(0, 6).map((f) => (
                      <Link key={f.id} href="/follow-ups" onClick={() => setOpen(false)} className={rowCls}>
                        <Lamp variant="caution" className="mt-0.5 flex-shrink-0">Due</Lamp>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{f.contactName}</p>
                          <p className="truncate text-xs text-dim">
                            {f.type}{f.course ? ` · ${f.course}` : ""}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {data.followUps.length > 6 && (
                      <p className="px-4 pb-1.5 text-xs text-faint" data-numeric>
                        +{data.followUps.length - 6} more
                      </p>
                    )}
                  </div>
                )}

                {data.payments.length > 0 && (
                  <div>
                    <p className="placard px-4 pb-1 pt-3">Overdue Payments</p>
                    {data.payments.slice(0, 6).map((p) => (
                      <Link key={p.id} href="/payments?status=Overdue" onClick={() => setOpen(false)} className={rowCls}>
                        <Lamp variant="alert" className="mt-0.5 flex-shrink-0">Ovd</Lamp>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{p.studentName}</p>
                          <p className="truncate text-xs text-dim">
                            <span className="readout" data-numeric>{fmt(p.amount)}</span>
                            {p.dueDate ? ` · Due ${p.dueDate}` : ""}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {data.payments.length > 6 && (
                      <p className="px-4 pb-1.5 text-xs text-faint" data-numeric>
                        +{data.payments.length - 6} more
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-bezel px-4 py-2.5">
            <Link
              href="/follow-ups"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-phos hover:underline"
            >
              All follow-ups →
            </Link>
            <Link
              href="/payments?status=Overdue"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-alert hover:underline"
            >
              Overdue payments →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
