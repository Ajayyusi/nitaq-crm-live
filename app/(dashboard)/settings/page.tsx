"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, Database, Info, CheckCircle2, Plus, X,
  Loader2, ShieldCheck, UserCog, User, Power, DollarSign,
  GraduationCap, Pencil, Phone, ImageIcon, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

const inp = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9] bg-white";

const ROLE_COLORS: Record<string, string> = {
  admin:   "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  sales:   "bg-green-100 text-green-700",
  finance: "bg-amber-100 text-amber-700",
  trainer: "bg-cyan-100 text-cyan-700",
};

const ROLE_ICONS: Record<string, typeof ShieldCheck> = {
  admin:   ShieldCheck,
  manager: UserCog,
  sales:   User,
  finance: DollarSign,
  trainer: GraduationCap,
};

const ALL_ROLES = [
  { value: "admin",   label: "Administrator" },
  { value: "manager", label: "Manager" },
  { value: "sales",   label: "Sales" },
  { value: "finance", label: "Finance" },
  { value: "trainer", label: "Trainer" },
];

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  mobileNumber: string;
  lastLogin: string | null;
  createdAt: string;
};

type NewUserForm = { name: string; email: string; password: string; role: string; mobileNumber: string };
const emptyNewForm: NewUserForm = { name: "", email: "", password: "", role: "sales", mobileNumber: "" };

type EditForm = { name: string; email: string; role: string; mobileNumber: string };

// ── Shared Section wrapper ────────────────────────────────────────────────────
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

// ── Staff Management ──────────────────────────────────────────────────────────
function StaffManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers]         = useState<StaffUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [newForm, setNewForm]     = useState<NewUserForm>(emptyNewForm);
  const [saving, setSaving]       = useState(false);

  // per-user panel state: null = closed, "edit" = edit form, "pw" = password reset
  const [openPanel, setOpenPanel]   = useState<{ id: string; mode: "edit" | "pw" } | null>(null);
  const [editForm, setEditForm]     = useState<EditForm>({ name: "", email: "", role: "sales", mobileNumber: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [newPw, setNewPw]           = useState("");
  const [pwSaving, setPwSaving]     = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toast.error("Failed to load staff accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  // ── Add new user ──────────────────────────────────────────────────────────
  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.user.name} added successfully.`);
      setAdding(false);
      setNewForm(emptyNewForm);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user.");
    } finally {
      setSaving(false);
    }
  }

  // ── Open edit panel for a user ────────────────────────────────────────────
  function openEdit(u: StaffUser) {
    if (openPanel?.id === u.id && openPanel.mode === "edit") {
      setOpenPanel(null);
      return;
    }
    setEditForm({ name: u.name, email: u.email, role: u.role, mobileNumber: u.mobileNumber });
    setOpenPanel({ id: u.id, mode: "edit" });
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  async function saveEdit(userId: string) {
    if (!editForm.name.trim()) { toast.error("Name is required."); return; }
    if (!editForm.email.trim()) { toast.error("Email is required."); return; }
    setEditSaving(true);
    try {
      const res  = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("User updated successfully.");
      setOpenPanel(null);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Toggle active / inactive ──────────────────────────────────────────────
  async function toggleActive(u: StaffUser) {
    if (u.id === currentUserId && u.active) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    const action = u.active ? "deactivate" : "activate";
    if (!confirm(`${u.active ? "Deactivate" : "Activate"} ${u.name}? ${u.active ? "They will no longer be able to log in." : ""}`)) return;
    try {
      const res  = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${u.name} ${u.active ? "deactivated" : "activated"} successfully.`);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} user.`);
    }
  }

  // ── Reset password ────────────────────────────────────────────────────────
  function openPw(u: StaffUser) {
    if (openPanel?.id === u.id && openPanel.mode === "pw") {
      setOpenPanel(null);
      setNewPw("");
      return;
    }
    setNewPw("");
    setOpenPanel({ id: u.id, mode: "pw" });
  }

  async function resetPassword(userId: string) {
    if (!newPw || newPw.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setPwSaving(true);
    try {
      const res  = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Password reset successfully.");
      setOpenPanel(null);
      setNewPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div>
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} staff account{users.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => { setAdding((v) => !v); setOpenPanel(null); }}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-xs font-bold text-white hover:bg-[#1B5E20]"
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? "Cancel" : "Add Staff"}
        </button>
      </div>

      {/* ── Add new staff form ─────────────────────────────────────────── */}
      {adding && (
        <div className="mb-5 overflow-hidden rounded-xl border border-[#2E7D32]/30 bg-[#E8F5E9]">
          <div className="border-b border-[#2E7D32]/20 px-5 py-4">
            <p className="text-sm font-bold text-[#0D1F0E]">Add New Staff Account</p>
          </div>
          <form onSubmit={addUser} className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Full Name *</label>
                <input required value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  className={inp} placeholder="Sara Al Mansoori" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Email *</label>
                <input required type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                  className={inp} placeholder="sara@nitaqacademy.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Mobile Number</label>
                <input type="tel" value={newForm.mobileNumber} onChange={(e) => setNewForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                  className={inp} placeholder="+971 50 XXX XXXX" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Role *</label>
                <select value={newForm.role} onChange={(e) => setNewForm((f) => ({ ...f, role: e.target.value }))} className={inp}>
                  {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">Password *</label>
                <input required type="password" minLength={8} value={newForm.password}
                  onChange={(e) => setNewForm((f) => ({ ...f, password: e.target.value }))}
                  className={inp} placeholder="Min. 8 characters" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setAdding(false)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-xs font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── User list ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-400">No staff accounts found. Add one above or load seed data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const RoleIcon = ROLE_ICONS[u.role] ?? User;
            const isSelf   = u.id === currentUserId;
            const panel    = openPanel?.id === u.id ? openPanel.mode : null;

            return (
              <div key={u.id} className={`overflow-hidden rounded-xl border transition ${u.active ? "border-slate-100 bg-slate-50" : "border-slate-100 bg-white opacity-60"}`}>
                {/* ── User row ── */}
                <div className="flex items-center gap-3 p-4">
                  {/* Avatar */}
                  <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-sm font-bold ${u.active ? "bg-[#1B5E20] text-white" : "bg-slate-200 text-slate-500"}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[#0D1F0E]">{u.name}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        <RoleIcon className="h-2.5 w-2.5" />
                        {ALL_ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </span>
                      {!u.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Inactive</span>}
                      {isSelf && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">You</span>}
                    </div>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    {u.mobileNumber && (
                      <p className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone className="h-3 w-3" />{u.mobileNumber}
                      </p>
                    )}
                    {u.lastLogin && (
                      <p className="text-[11px] text-slate-400">Last login: {new Date(u.lastLogin).toLocaleDateString("en-AE")}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <button
                      onClick={() => openEdit(u)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${panel === "edit" ? "border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32]" : "border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"}`}
                    >
                      <Pencil className="inline h-3 w-3 mr-1" />Edit
                    </button>
                    <button
                      onClick={() => openPw(u)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${panel === "pw" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"}`}
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => void toggleActive(u)}
                      disabled={isSelf && u.active}
                      title={isSelf && u.active ? "Cannot deactivate your own account" : u.active ? "Deactivate" : "Activate"}
                      className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${u.active ? "border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600" : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"}`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── Edit panel ── */}
                {panel === "edit" && (
                  <div className="border-t border-slate-100 bg-white px-5 py-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Edit Details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Full Name *</label>
                        <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className={inp} placeholder="Full name" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Email *</label>
                        <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          className={inp} placeholder="email@example.com" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Mobile Number</label>
                        <input type="tel" value={editForm.mobileNumber} onChange={(e) => setEditForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                          className={inp} placeholder="+971 50 XXX XXXX" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Role *</label>
                        <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className={inp}>
                          {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setOpenPanel(null)}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        Cancel
                      </button>
                      <button onClick={() => void saveEdit(u.id)} disabled={editSaving}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-xs font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                        {editSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Password reset panel ── */}
                {panel === "pw" && (
                  <div className="border-t border-slate-100 bg-white px-5 py-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Reset Password for {u.name}</p>
                    <div className="flex gap-2">
                      <input type="password" minLength={8} value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
                        placeholder="New password (min 8 characters)" />
                      <button onClick={() => void resetPassword(u.id)} disabled={pwSaving}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                        {pwSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save
                      </button>
                      <button onClick={() => { setOpenPanel(null); setNewPw(""); }}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
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

// ── Backfill button ───────────────────────────────────────────────────────────
function BackfillButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    if (!window.confirm("This will create Payment records for any enrollment that has an Amount Paid but no linked payment yet. Continue?")) return;
    setState("loading");
    try {
      const res = await fetch("/api/admin/backfill-payments", { method: "POST" }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMsg(res.message ?? "Done.");
      setState("done");
      toast.success("Backfill complete!");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Backfill failed.");
      setState("error");
      toast.error("Backfill failed.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        If enrollments were created before the payment auto-recording fix, run this once to create the missing Payment records so they appear in Finance and Dashboard revenue.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={run}
          disabled={state === "loading" || state === "done"}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "loading" ? "Running…" : state === "done" ? "Done ✓" : "Backfill Enrollment Payments"}
        </button>
        {msg && <p className={`text-sm font-medium ${state === "error" ? "text-rose-600" : "text-[#2E7D32]"}`}>{msg}</p>}
      </div>
    </div>
  );
}

// ── Seed button ───────────────────────────────────────────────────────────────
function SeedButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg]     = useState("");

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
        Load realistic sample data: 3 staff accounts, 15 leads, 5 enrollments, 6 payments, 8 follow-ups, 5 expenses.
        Also runs the legacy role migration (staff → sales).
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={seed}
          disabled={state === "loading" || state === "done"}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-800 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "loading" ? "Loading…" : state === "done" ? "Done ✓" : "Load Seed Data"}
        </button>
        {msg && <p className={`text-sm font-medium ${state === "error" ? "text-rose-600" : "text-[#2E7D32]"}`}>{msg}</p>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const role = (session?.user as { role?: string })?.role;
      if (role !== "admin") router.replace("/access-denied");
    }
  }, [status, session, router]);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [logoBase64, setLogoBase64] = useState("");
  const [logoSaving, setLogoSaving] = useState(false);
  const [academy, setAcademy] = useState({
    academyNameEn: "Nitaq Academy",
    academyNameAr: "أكاديمية نطاق",
    city: "Sharjah",
    phone: "",
    whatsappNumber: "",
    email: "",
    website: "",
    address: "",
  });
  const [finance, setFinance] = useState({
    vatEnabled: false,
    vatRate: "5",
    vatNumber: "",
    currency: "AED",
    receiptPrefix: "NITAQ-R",
  });
  const [academySaving, setAcademySaving] = useState(false);
  const [financeSaving, setFinanceSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (res.ok) {
          setLogoBase64(data.logoBase64 ?? "");
          setAcademy({
            academyNameEn: data.academyNameEn ?? "Nitaq Academy",
            academyNameAr: data.academyNameAr ?? "أكاديمية نطاق",
            city:          data.city ?? "Sharjah",
            phone:         data.phone ?? "",
            whatsappNumber:data.whatsappNumber ?? "",
            email:         data.email ?? "",
            website:       data.website ?? "",
            address:       data.address ?? "",
          });
          setFinance({
            vatEnabled:    data.vatEnabled ?? false,
            vatRate:       String(data.vatRate ?? 5),
            vatNumber:     data.vatNumber ?? "",
            currency:      data.currency ?? "AED",
            receiptPrefix: data.receiptPrefix ?? "NITAQ-R",
          });
        }
      } catch {
        toast.error("Could not load settings.");
      } finally {
        setSettingsLoading(false);
      }
    }
    void load();
  }, []);

  async function saveAcademy() {
    setAcademySaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(academy),
      });
      if (!res.ok) throw new Error();
      toast.success("Academy information saved.");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setAcademySaving(false);
    }
  }

  async function saveFinance() {
    setFinanceSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...finance,
          vatRate: Number(finance.vatRate) || 5,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Finance settings saved.");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setFinanceSaving(false);
    }
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("Logo must be under 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function saveLogo(base64: string) {
    setLogoSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoBase64: base64 }),
      });
      if (!res.ok) throw new Error();
      window.dispatchEvent(new CustomEvent("logo-updated", { detail: { logoBase64: base64 } }));
      toast.success(base64 ? "Logo saved." : "Logo removed.");
    } catch {
      toast.error("Failed to save logo.");
    } finally {
      setLogoSaving(false);
    }
  }

  const currentUserId = (session?.user as { id?: string })?.id ?? "";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">System</p>
        <h1 className="mt-1 text-3xl font-bold text-[#0D1F0E]">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Academy configuration, staff management, and system tools</p>
      </div>

      {/* Academy info */}
      <Section icon={Building2} title="Academy Information">
        {settingsLoading ? (
          <div className="flex items-center gap-2 py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Academy Name (English)</label>
              <input className={inp} value={academy.academyNameEn}
                onChange={(e) => setAcademy((a) => ({ ...a, academyNameEn: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Academy Name (Arabic)</label>
              <input className={inp} dir="rtl" value={academy.academyNameAr}
                onChange={(e) => setAcademy((a) => ({ ...a, academyNameAr: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">City</label>
              <input className={inp} value={academy.city}
                onChange={(e) => setAcademy((a) => ({ ...a, city: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Phone</label>
              <input className={inp} value={academy.phone}
                onChange={(e) => setAcademy((a) => ({ ...a, phone: e.target.value }))} placeholder="+971 6 XXX XXXX" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">WhatsApp Number</label>
              <input className={inp} value={academy.whatsappNumber}
                onChange={(e) => setAcademy((a) => ({ ...a, whatsappNumber: e.target.value }))} placeholder="+971 50 XXX XXXX" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Email</label>
              <input className={inp} type="email" value={academy.email}
                onChange={(e) => setAcademy((a) => ({ ...a, email: e.target.value }))} placeholder="info@nitaqacademy.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Website</label>
              <input className={inp} value={academy.website}
                onChange={(e) => setAcademy((a) => ({ ...a, website: e.target.value }))} placeholder="https://nitaqacademy.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Address</label>
              <input className={inp} value={academy.address}
                onChange={(e) => setAcademy((a) => ({ ...a, address: e.target.value }))} placeholder="Building, Street, City" />
            </div>
            <div className="sm:col-span-2 mt-1">
              <button
                onClick={() => void saveAcademy()}
                disabled={academySaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60"
              >
                {academySaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Academy Info
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Finance defaults */}
      <Section icon={DollarSign} title="Finance Defaults">
        {settingsLoading ? (
          <div className="flex items-center gap-2 py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFinance((f) => ({ ...f, vatEnabled: !f.vatEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${finance.vatEnabled ? "bg-[#2E7D32]" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${finance.vatEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  VAT Enabled {finance.vatEnabled ? <span className="text-[#2E7D32]">(On)</span> : <span className="text-slate-400">(Off)</span>}
                </span>
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">VAT Rate (%)</label>
              <input
                className={inp} type="number" min="0" max="100" step="0.01"
                value={finance.vatRate}
                onChange={(e) => setFinance((f) => ({ ...f, vatRate: e.target.value }))}
                disabled={!finance.vatEnabled}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">VAT / TRN Number</label>
              <input className={inp} value={finance.vatNumber}
                onChange={(e) => setFinance((f) => ({ ...f, vatNumber: e.target.value }))}
                placeholder="TRN..." disabled={!finance.vatEnabled} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Currency</label>
              <select className={inp} value={finance.currency}
                onChange={(e) => setFinance((f) => ({ ...f, currency: e.target.value }))}>
                <option value="AED">AED — UAE Dirham</option>
                <option value="USD">USD — US Dollar</option>
                <option value="SAR">SAR — Saudi Riyal</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Receipt Prefix</label>
              <input className={inp} value={finance.receiptPrefix}
                onChange={(e) => setFinance((f) => ({ ...f, receiptPrefix: e.target.value }))}
                placeholder="NITAQ-R" />
              <p className="mt-1 text-xs text-slate-400">Receipts will be numbered: {finance.receiptPrefix}-0001</p>
            </div>
            <div className="sm:col-span-2 mt-1">
              <button
                onClick={() => void saveFinance()}
                disabled={financeSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60"
              >
                {financeSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Finance Settings
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Staff accounts */}
      <Section icon={Users} title="Staff Accounts">
        <StaffManagement currentUserId={currentUserId} />
      </Section>

      {/* Seed data */}
      <Section icon={Database} title="Demo / Seed Data">
        <SeedButton />
      </Section>

      {/* Logo */}
      <Section icon={ImageIcon} title="Academy Logo">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload your academy logo. It will appear in the sidebar. PNG, JPG, or SVG — max 500 KB.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Preview */}
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden">
              {logoBase64 ? (
                <img src={logoBase64} alt="Academy Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-[10px] font-medium">No logo</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]">
                <ImageIcon className="h-4 w-4" />
                Choose Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoFile}
                />
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => void saveLogo(logoBase64)}
                  disabled={logoSaving}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-xs font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60"
                >
                  {logoSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Logo
                </button>
                {logoBase64 && (
                  <button
                    onClick={() => { setLogoBase64(""); void saveLogo(""); }}
                    disabled={logoSaving}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 px-4 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400">Logo is stored securely in the database — no file upload to the server.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Maintenance */}
      <Section icon={Database} title="Maintenance">
        <BackfillButton />
      </Section>

      {/* System info */}
      <Section icon={Info} title="System Information">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {[
            ["Platform", "Nitaq Academy CRM"],
            ["Version", "1.2.0"],
            ["Framework", "Next.js 16 + MongoDB"],
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
