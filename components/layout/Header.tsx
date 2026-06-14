"use client";

import { useState } from "react";
import { Menu, KeyRound, X, Loader2, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationPanel } from "./NotificationPanel";
import { useSession } from "next-auth/react";

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (next !== confirm) { setError("New passwords do not match."); return; }
    if (next.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed.");
      setSuccess("Password changed successfully.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-[#0D1F0E] px-6 py-5 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Account</p>
              <h2 className="mt-0.5 text-lg font-bold">Change Password</h2>
            </div>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4 p-6">
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
            {success && <div className="rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]">{success}</div>}
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Current password</label>
              <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inp} autoComplete="current-password" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">New password</label>
              <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className={inp} autoComplete="new-password" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Confirm new password</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inp} autoComplete="new-password" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { data: session } = useSession();
  const [pwOpen, setPwOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const userName = session?.user?.name ?? "";
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NA";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-700/80 dark:bg-[#112013]/95">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 2xl:px-10">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          className="lg:hidden grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:border-slate-700 dark:bg-[#112013] dark:text-slate-300 dark:hover:border-[#2E7D32] dark:hover:bg-[#1a2e1b]"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0D1F0E] truncate dark:text-[#e8f5e9]">Nitaq Academy</p>
          <p className="mt-0.5 text-xs text-slate-500 hidden sm:block dark:text-slate-400">
            CRM &amp; Operations
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full border border-green-200 bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#2E7D32] lg:inline-flex dark:border-green-900 dark:bg-[#0c1a0d] dark:text-[#4CAF50]">
            Sharjah
          </span>
          <ThemeToggle />
          <NotificationPanel />

          {/* User avatar with dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1B5E20] text-xs font-bold text-white shadow-sm hover:bg-[#2E7D32] transition"
              title={userName || "Account"}
            >
              {initials}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Signed in as</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{userName || "User"}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setMenuOpen(false); setPwOpen(true); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#E8F5E9] hover:text-[#2E7D32] transition"
                    >
                      <KeyRound className="h-4 w-4" />
                      Change Password
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </header>
  );
}
