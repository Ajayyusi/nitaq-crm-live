"use client";

import { useEffect, useState } from "react";
import { Menu, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationPanel } from "./NotificationPanel";
import GlobalSearch from "./GlobalSearch";
import { useSession } from "next-auth/react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Lamp } from "@/components/ui/lamp";

function Notice({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2.5 text-sm font-semibold text-alert"
          : "rounded-ctl border border-phos/30 bg-[var(--lamp-ok-bg)] px-3 py-2.5 text-sm font-semibold text-phos"
      }
    >
      {children}
    </div>
  );
}

function TwoFactorModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<"loading" | "off" | "setup" | "on">("loading");
  const [qr, setQr] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/users/me/2fa")
      .then((r) => r.json())
      .then((d) => setStatus(d.enabled ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  async function call(body: Record<string, string>) {
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/users/me/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Failed.");
      return d;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const startSetup = async () => {
    const d = await call({ action: "setup" });
    if (d) { setQr(d.qrDataUrl); setManualKey(d.manualKey); setStatus("setup"); setCode(""); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await call({ action: "verify", code });
    if (d) { setStatus("on"); setSuccess(d.message); setCode(""); }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await call({ action: "disable", password, code });
    if (d) { setStatus("off"); setSuccess(d.message); setCode(""); setPassword(""); }
  };

  return (
    <Dialog open onClose={onClose} title="Two-Factor Authentication" size="sm">
      <div className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        {success && <Notice kind="success">{success}</Notice>}

        {status === "loading" && (
          <div className="flex h-24 items-center justify-center text-faint">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {status === "off" && (
          <>
            <p className="text-sm text-dim">
              Protect your account with a 6-digit code from an authenticator app
              (Google Authenticator, Microsoft Authenticator, Authy…) in addition to your password.
            </p>
            <Button variant="solid" className="w-full" onClick={startSetup} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enable 2FA
            </Button>
          </>
        )}

        {status === "setup" && (
          <form onSubmit={verify} className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-dim">
              <li>Open your authenticator app</li>
              <li>Scan this QR code</li>
              <li>Enter the 6-digit code below</li>
            </ol>
            {qr && (
              <div className="flex justify-center rounded-card border border-bezel bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="2FA QR code" className="h-48 w-48" />
              </div>
            )}
            <p className="break-all rounded-ctl bg-well px-3 py-2 text-center text-xs text-dim">
              Can&apos;t scan? Enter manually: <strong className="readout">{manualKey}</strong>
            </p>
            <Input
              type="text" inputMode="numeric" maxLength={6} required autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="readout text-center text-lg font-bold tracking-[0.5em]"
              aria-label="6-digit verification code"
            />
            <Button type="submit" variant="solid" className="w-full" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify &amp; Turn On
            </Button>
          </form>
        )}

        {status === "on" && (
          <form onSubmit={disable} className="space-y-4">
            <div className="flex items-center gap-2">
              <Lamp variant="ok">2FA Armed</Lamp>
              <span className="text-sm text-dim">Two-factor authentication is on.</span>
            </div>
            <p className="text-sm text-dim">To turn it off, confirm your password and a current code:</p>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password" autoComplete="current-password" aria-label="Password" />
            <Input type="text" inputMode="numeric" maxLength={6} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code" className="readout text-center font-bold tracking-[0.4em]"
              aria-label="6-digit verification code" />
            <Button type="submit" variant="danger" className="w-full" disabled={busy || code.length !== 6 || !password}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Turn Off 2FA
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}

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

  return (
    <Dialog open onClose={onClose} title="Change Password" size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        {success && <Notice kind="success">{success}</Notice>}
        <Field label="Current password" required>
          <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" required help="At least 8 characters.">
          <Input type="password" required value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="solid" className="flex-1" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { data: session } = useSession();
  const [pwOpen, setPwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);
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
    <header className="border-b border-bezel bg-panel/90 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6 2xl:px-10">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-ctl border border-bezel text-dim transition hover:border-phos hover:text-phos lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Brand appears here only on mobile, where the sidebar is hidden */}
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink lg:hidden">
          Nitaq Academy
        </p>
        <div className="hidden min-w-0 flex-1 lg:block" />

        <div className="flex items-center gap-1.5 sm:gap-2">
          <GlobalSearch />
          <ThemeToggle />
          <NotificationPanel />

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-ctl border border-bezel bg-face text-xs font-bold text-ink transition hover:border-phos hover:text-phos"
              title={userName || "Account"}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {initials}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  role="menu"
                  className="absolute right-0 top-11 z-50 w-56 rounded-card border border-bezel bg-raised shadow-raise"
                >
                  <div className="border-b border-bezel px-4 py-3">
                    <p className="placard">Signed in as</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-ink">{userName || "User"}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setPwOpen(true); }}
                      className="flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold text-dim transition hover:bg-well hover:text-ink"
                    >
                      <KeyRound className="h-4 w-4" />
                      Change Password
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setTfaOpen(true); }}
                      className="flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold text-dim transition hover:bg-well hover:text-ink"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Two-Factor Auth
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      {tfaOpen && <TwoFactorModal onClose={() => setTfaOpen(false)} />}
    </header>
  );
}
