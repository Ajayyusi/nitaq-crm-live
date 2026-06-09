"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Database, Info, CheckCircle2, Plus, X, Loader2, ShieldCheck, UserCog, User, Power } from "lucide-react";
import toast from "react-hot-toast";

const inp = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9] bg-white";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  staff: "bg-green-100 text-green-700",
};

const ROLE_ICONS: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  manager: UserCog,
  staff: User,
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
};

type NewUserForm = { name: string; email: string; password: string; role: string };
const emptyForm: NewUserForm = { name: "", email: "", password: "", role: "staff" };

function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#E8F5E9]">
          <Icon className="h-4 w-4 text-[#2E7D32]" />
        </div>
        <h2 className="text-sm font-bold text-[#0D1F0E]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function StaffManagement() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewUserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toast.error("Failed to load staff accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.user.name} added successfully.`);
      setAdding(false);
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: StaffUser) {
    const action = user.active ? "Deactivate" : "Activate";
    if (!confirm(`${action} ${user.name}?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${user.name} ${user.active ? "deactivated" : "activated"}.`);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function resetPassword(userId: string) {
    if (!newPw || newPw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Password reset successfully.");
      setResetId(null);
      setNewPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} staff account{users.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-xs font-bold text-white hover:bg-[#1B5E20]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Staff
        </button>
      </div>

      {/* Add staff modal */}
      {adding && (
        <div className="mb-4 overflow-hidden rounded-xl border border-[#2E7D32]/30 bg-[#E8F5E9]">
          <div className="flex items-center justify-between border-b border-[#2E7D32]/20 px-5 py-4">
            <p className="text-sm font-bold text-[#0D1F0E]">Add New Staff Account</p>
            <button onClick={() => setAdding(false)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[#2E7D32]/10">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <form onSubmit={addUser} className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Full Name *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inp} placeholder="Sara Al Mansoori" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inp} placeholder="sara@nitaqacademy.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Password *</label>
                <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inp} placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Role *</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inp}>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-xs font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-400">No staff accounts found. Run seed data or add accounts above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const Icon = ROLE_ICONS[u.role] ?? User;
            return (
              <div
                key={u.id}
                className={`rounded-xl border p-4 transition ${u.active ? "border-slate-100 bg-slate-50" : "border-slate-100 bg-white opacity-60"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-sm font-bold ${u.active ? "bg-[#1B5E20] text-white" : "bg-slate-200 text-slate-500"}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#0D1F0E] text-sm">{u.name}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                      {!u.active && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{u.email}</p>
                    {u.lastLogin && (
                      <p className="text-[11px] text-slate-400">Last login: {new Date(u.lastLogin).toLocaleDateString("en-AE")}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setResetId(resetId === u.id ? null : u.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => void toggleActive(u)}
                      title={u.active ? "Deactivate" : "Activate"}
                      className={`grid h-8 w-8 place-items-center rounded-lg border transition ${u.active ? "border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600" : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"}`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Password reset inline form */}
                {resetId === u.id && (
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <input
                      type="password"
                      minLength={8}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
                      placeholder="New password (min 8 chars)"
                    />
                    <button
                      onClick={() => void resetPassword(u.id)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setResetId(null); setNewPw(""); }}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeedButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function seed() {
    setState("loading");
    try {
      const res = await fetch("/api/seed", { method: "POST" }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMsg(res.message ?? "Seed data loaded.");
      setState("done");
      toast.success("Seed data loaded successfully!");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Seed failed.");
      setState("error");
      toast.error("Seed failed.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Load realistic sample data to explore the CRM: 3 staff accounts, 15 leads, 5 enrollments, 6 payments, 8 follow-ups, 5 expenses.
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={seed}
          disabled={state === "loading" || state === "done"}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-800 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "loading" ? "Loading…" : state === "done" ? "Done" : "Load Seed Data"}
        </button>
        {msg && <p className={`text-sm font-medium ${state === "error" ? "text-rose-600" : "text-[#2E7D32]"}`}>{msg}</p>}
      </div>
      <p className="text-xs text-slate-400">
        Credentials: admin@nitaqacademy.com / NitaqAdmin2026! · muzzamil@nitaqacademy.com / NitaqManager2026! · staff@nitaqacademy.com / NitaqStaff2026!
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const [academy, setAcademy] = useState({
    name: "Nitaq Academy",
    nameAr: "أكاديمية نطاق",
    city: "Sharjah",
    phone: "+971 6 XXX XXXX",
    email: "info@nitaqacademy.com",
    vatNumber: "",
    vatRate: "5",
  });
  const [saved, setSaved] = useState(false);

  function saveAcademy() {
    setSaved(true);
    toast.success("Academy settings saved.");
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">System</p>
        <h1 className="mt-1 text-3xl font-bold text-[#0D1F0E]">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Academy configuration, staff management, and system tools</p>
      </div>

      {/* Academy info */}
      <Section icon={Building2} title="Academy Information">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Academy Name (English)</label>
            <input className={inp} value={academy.name} onChange={(e) => setAcademy((a) => ({ ...a, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Academy Name (Arabic)</label>
            <input className={inp} dir="rtl" value={academy.nameAr} onChange={(e) => setAcademy((a) => ({ ...a, nameAr: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">City</label>
            <input className={inp} value={academy.city} onChange={(e) => setAcademy((a) => ({ ...a, city: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Phone</label>
            <input className={inp} value={academy.phone} onChange={(e) => setAcademy((a) => ({ ...a, phone: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-700">Email</label>
            <input className={inp} type="email" value={academy.email} onChange={(e) => setAcademy((a) => ({ ...a, email: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">VAT / TRN Number</label>
            <input className={inp} value={academy.vatNumber} onChange={(e) => setAcademy((a) => ({ ...a, vatNumber: e.target.value }))} placeholder="TRN..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">VAT Rate (%)</label>
            <input className={inp} type="number" min="0" max="100" value={academy.vatRate} onChange={(e) => setAcademy((a) => ({ ...a, vatRate: e.target.value }))} />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={saveAcademy}
            className="h-10 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white hover:bg-[#1B5E20]"
          >
            Save Changes
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-[#2E7D32]">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </Section>

      {/* Staff accounts */}
      <Section icon={Users} title="Staff Accounts">
        <StaffManagement />
      </Section>

      {/* Seed data */}
      <Section icon={Database} title="Demo / Seed Data">
        <SeedButton />
      </Section>

      {/* System info */}
      <Section icon={Info} title="System Information">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Platform", "Nitaq Academy CRM"],
            ["Version", "1.0.0"],
            ["Framework", "Next.js 15 + MongoDB"],
            ["Auth", "NextAuth.js v5 (JWT)"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="mt-0.5 font-semibold text-[#0D1F0E]">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
