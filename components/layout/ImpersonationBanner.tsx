"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Eye, LogOut, Loader2 } from "lucide-react";

/**
 * Always-visible strip shown while an admin is viewing the CRM as another
 * user, so an impersonated session can never be mistaken for a real one.
 */
export default function ImpersonationBanner() {
  const { data: session } = useSession();
  const [leaving, setLeaving] = useState(false);
  const u = session?.user as
    | { name?: string; role?: string; impersonatedBy?: string }
    | undefined;
  if (!u?.impersonatedBy) return null;

  // Swap back to the admin's own account rather than dumping them at the
  // login screen — the browser only holds one session cookie at a time.
  async function exitImpersonation() {
    setLeaving(true);
    try {
      const res = await fetch("/api/impersonate/exit", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      /* fall through to a plain sign-out */
    }
    signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="sticky top-0 z-[70] flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-[#0D1F0E] print:hidden">
      <Eye className="h-4 w-4 flex-shrink-0" />
      <p className="text-xs font-bold">
        Viewing as {u.name}{u.role ? ` (${u.role})` : ""} — you are signed in as {u.impersonatedBy}.
      </p>
      <p className="hidden text-xs sm:block">Anything you do here is recorded against this account.</p>
      <button
        onClick={exitImpersonation}
        disabled={leaving}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#0D1F0E] px-3 py-1 text-xs font-bold text-white transition hover:bg-black disabled:opacity-60"
      >
        {leaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
        {leaving ? "Returning…" : "Back to my account"}
      </button>
    </div>
  );
}
