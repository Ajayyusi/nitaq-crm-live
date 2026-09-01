"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, Database, Info, Plus, X,
  ShieldCheck, UserCog, User, Power, DollarSign,
  GraduationCap, Pencil, Phone, ImageIcon, Trash2, Copy, KeyRound,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input, Select, Field } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Lamp } from "@/components/ui/lamp";
import { Spinner, LoadError } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-ctl border border-bezel bg-well">
            <Icon className="h-4 w-4 text-phos" aria-hidden />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SectionLoading() {
  return (
    <div className="flex items-center gap-2 py-4 text-dim">
      <Spinner />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

// ── Staff Management ──────────────────────────────────────────────────────────
function StaffManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers]         = useState<StaffUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding]       = useState(false);
  const [newForm, setNewForm]     = useState<NewUserForm>(emptyNewForm);
  const [newErrors, setNewErrors] = useState<Partial<Record<keyof NewUserForm, string>>>({});
  const [saving, setSaving]       = useState(false);

  // per-user panel state: null = closed, "edit" = edit form, "pw" = password reset
  const [openPanel, setOpenPanel]   = useState<{ id: string; mode: "edit" | "pw" } | null>(null);
  const [editForm, setEditForm]     = useState<EditForm>({ name: "", email: "", role: "sales", mobileNumber: "" });
  const [editErrors, setEditErrors] = useState<{ name?: string; email?: string }>({});
  const [editSaving, setEditSaving] = useState(false);
  const [newPw, setNewPw]           = useState("");
  const [pwError, setPwError]       = useState("");
  const [pwSaving, setPwSaving]     = useState(false);

  // ConfirmDialog target for activate/deactivate
  const [toggleTarget, setToggleTarget] = useState<StaffUser | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  // ── Add new user ──────────────────────────────────────────────────────────
  function validateNewForm(): boolean {
    const errs: Partial<Record<keyof NewUserForm, string>> = {};
    if (!newForm.name.trim()) errs.name = "Full name is required.";
    if (!newForm.email.trim()) errs.email = "Email is required.";
    if (!newForm.password || newForm.password.length < 8) errs.password = "Password must be at least 8 characters.";
    setNewErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!validateNewForm()) return;
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
      setNewErrors({});
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
    setEditErrors({});
    setOpenPanel({ id: u.id, mode: "edit" });
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  async function saveEdit(userId: string) {
    const errs: { name?: string; email?: string } = {};
    if (!editForm.name.trim()) errs.name = "Name is required.";
    if (!editForm.email.trim()) errs.email = "Email is required.";
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
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

  // ── Toggle active / inactive (ConfirmDialog replaces window.confirm) ──────
  function requestToggle(u: StaffUser) {
    if (u.id === currentUserId && u.active) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    setToggleTarget(u);
  }

  async function confirmToggle() {
    const u = toggleTarget;
    if (!u) return;
    const action = u.active ? "deactivate" : "activate";
    setToggling(true);
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
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  }

  // ── Reset password ────────────────────────────────────────────────────────
  function openPw(u: StaffUser) {
    if (openPanel?.id === u.id && openPanel.mode === "pw") {
      setOpenPanel(null);
      setNewPw("");
      setPwError("");
      return;
    }
    setNewPw("");
    setPwError("");
    setOpenPanel({ id: u.id, mode: "pw" });
  }

  async function resetPassword(userId: string) {
    if (!newPw || newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    setPwError("");
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
        <p className="readout text-sm text-dim" data-numeric>
          {users.length} staff account{users.length !== 1 ? "s" : ""}
        </p>
        <Button
          variant={adding ? "secondary" : "primary"}
          size="sm"
          onClick={() => { setAdding((v) => !v); setOpenPanel(null); }}
        >
          {adding ? <X className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          {adding ? "Cancel" : "Add Staff"}
        </Button>
      </div>

      {/* ── Add new staff form ─────────────────────────────────────────── */}
      {adding && (
        <div className="mb-5 overflow-hidden rounded-card border border-phos/40 bg-well">
          <div className="border-b border-bezel px-5 py-3.5">
            <p className="text-sm font-bold text-ink">Add New Staff Account</p>
          </div>
          <form onSubmit={addUser} noValidate className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full Name" required htmlFor="newName" error={newErrors.name}>
                <Input id="newName" value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Sara Al Mansoori" />
              </Field>
              <Field label="Email" required htmlFor="newEmail" error={newErrors.email}>
                <Input id="newEmail" type="email" value={newForm.email}
                  onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="sara@nitaqacademy.com" />
              </Field>
              <Field label="Mobile Number" htmlFor="newMobile">
                <Input id="newMobile" type="tel" value={newForm.mobileNumber}
                  onChange={(e) => setNewForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                  placeholder="+971 50 XXX XXXX" />
              </Field>
              <Field label="Role" required htmlFor="newRole">
                <Select id="newRole" value={newForm.role} onChange={(e) => setNewForm((f) => ({ ...f, role: e.target.value }))}>
                  {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </Field>
              <Field label="Password" required htmlFor="newPassword" error={newErrors.password} className="sm:col-span-2">
                <Input id="newPassword" type="password" minLength={8} value={newForm.password}
                  onChange={(e) => setNewForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters" />
              </Field>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="flex-1" disabled={saving}>
                {saving && <Spinner className="h-3.5 w-3.5" />}
                Create Account
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── User list ─────────────────────────────────────────────────── */}
      {loading ? (
        <SectionLoading />
      ) : loadFailed ? (
        <LoadError message="Couldn't load staff accounts." onRetry={() => void loadUsers()} />
      ) : users.length === 0 ? (
        <div className="rounded-card border border-dashed border-bezel-strong py-10 text-center">
          <p className="text-sm text-dim">No staff accounts found. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const RoleIcon = ROLE_ICONS[u.role] ?? User;
            const isSelf   = u.id === currentUserId;
            const panel    = openPanel?.id === u.id ? openPanel.mode : null;

            return (
              <div key={u.id} className={cn("overflow-hidden rounded-card border border-bezel bg-well transition", !u.active && "opacity-60")}>
                {/* ── User row ── */}
                <div className="flex items-center gap-3 p-4">
                  {/* Avatar */}
                  <div
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border text-sm font-bold",
                      u.active ? "border-phos/40 bg-[var(--lamp-ok-bg)] text-phos" : "border-bezel bg-well text-faint"
                    )}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink">{u.name}</p>
                      <Lamp variant="off">
                        <RoleIcon className="h-2.5 w-2.5" aria-hidden />
                        {ALL_ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </Lamp>
                      {!u.active && <Lamp variant="alert">Inactive</Lamp>}
                      {isSelf && <Lamp variant="advisory">You</Lamp>}
                    </div>
                    <p className="text-xs text-dim">{u.email}</p>
                    {u.mobileNumber && (
                      <p className="flex items-center gap-1 text-xs text-faint">
                        <Phone className="h-3 w-3" aria-hidden />{u.mobileNumber}
                      </p>
                    )}
                    {u.lastLogin && (
                      <p className="readout text-[11px] text-faint" data-numeric>
                        Last login: {new Date(u.lastLogin).toLocaleDateString("en-AE")}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <Button
                      variant={panel === "edit" ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => openEdit(u)}
                      aria-expanded={panel === "edit"}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />Edit
                    </Button>
                    <Button
                      variant={panel === "pw" ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => openPw(u)}
                      aria-expanded={panel === "pw"}
                    >
                      <KeyRound className="h-3 w-3" aria-hidden />Reset PW
                    </Button>
                    <Button
                      variant={u.active ? "ghost" : "primary"}
                      size="iconSm"
                      onClick={() => requestToggle(u)}
                      disabled={isSelf && u.active}
                      title={isSelf && u.active ? "Cannot deactivate your own account" : u.active ? "Deactivate" : "Activate"}
                      aria-label={u.active ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                    >
                      <Power className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>

                {/* ── Edit panel ── */}
                {panel === "edit" && (
                  <div className="border-t border-bezel bg-face px-5 py-4">
                    <p className="placard mb-3">Edit Details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Full Name" required htmlFor={`editName-${u.id}`} error={editErrors.name}>
                        <Input id={`editName-${u.id}`} value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Full name" />
                      </Field>
                      <Field label="Email" required htmlFor={`editEmail-${u.id}`} error={editErrors.email}>
                        <Input id={`editEmail-${u.id}`} type="email" value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="email@example.com" />
                      </Field>
                      <Field label="Mobile Number" htmlFor={`editMobile-${u.id}`}>
                        <Input id={`editMobile-${u.id}`} type="tel" value={editForm.mobileNumber}
                          onChange={(e) => setEditForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                          placeholder="+971 50 XXX XXXX" />
                      </Field>
                      <Field label="Role" required htmlFor={`editRole-${u.id}`}>
                        <Select id={`editRole-${u.id}`} value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                          {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setOpenPanel(null)}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" className="flex-1" onClick={() => void saveEdit(u.id)} disabled={editSaving}>
                        {editSaving && <Spinner className="h-3.5 w-3.5" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Password reset panel ── */}
                {panel === "pw" && (
                  <div className="border-t border-bezel bg-face px-5 py-4">
                    <p className="placard mb-3">Reset Password for {u.name}</p>
                    <div className="flex items-start gap-2">
                      <Field label="New Password" required htmlFor={`pw-${u.id}`} error={pwError} className="flex-1 [&>label]:sr-only">
                        <Input id={`pw-${u.id}`} type="password" minLength={8} value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="New password (min 8 characters)" />
                      </Field>
                      <Button variant="primary" size="sm" className="h-9" onClick={() => void resetPassword(u.id)} disabled={pwSaving}>
                        {pwSaving && <Spinner className="h-3 w-3" />}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => { setOpenPanel(null); setNewPw(""); setPwError(""); }}
                        aria-label="Close password panel"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={toggleTarget != null}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => void confirmToggle()}
        title={toggleTarget?.active ? "Deactivate Account" : "Activate Account"}
        message={
          toggleTarget?.active
            ? `Deactivate ${toggleTarget?.name}? They will no longer be able to log in.`
            : `Activate ${toggleTarget?.name}? They will be able to log in again.`
        }
        confirmLabel={toggleTarget?.active ? "Deactivate" : "Activate"}
        danger={toggleTarget?.active ?? false}
        busy={toggling}
      />
    </div>
  );
}

// ── Super Admin button ────────────────────────────────────────────────────────
function SuperAdminButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ email: string; password: string; message: string; note: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setConfirming(false);
    setState("loading");
    try {
      const res = await fetch("/api/admin/create-super-admin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data);
      setState("done");
    } catch (e) {
      setState("error");
      toast.error(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function copyPassword() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.password);
      toast.success("Password copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-dim">
        Creates a permanent <strong className="text-ink">Super Admin</strong> account with full access. Safe to run multiple times — resets the password if the account already exists.
      </p>
      {result && (
        <div className="space-y-2 rounded-card border border-phos/30 bg-[var(--lamp-ok-bg)] p-4 text-sm">
          <p className="font-bold text-phos">{result.message}</p>
          <p className="text-dim">
            <span className="font-semibold text-ink">Email:</span>{" "}
            <code className="readout rounded-ctl bg-well px-2 py-0.5 text-ink">{result.email}</code>
          </p>
          <div className="flex flex-wrap items-center gap-2 text-dim">
            <span className="font-semibold text-ink">Password:</span>
            <code className="readout rounded-ctl bg-well px-2 py-0.5 text-ink" aria-hidden>••••••••</code>
            <Button variant="secondary" size="sm" onClick={() => void copyPassword()}>
              <Copy className="h-3.5 w-3.5" aria-hidden /> Copy Password
            </Button>
          </div>
          <p className="mt-2 text-xs font-semibold text-caution">
            The password is not shown on screen — use Copy Password and store it somewhere safe. {result.note}
          </p>
        </div>
      )}
      <Button variant="primary" onClick={() => setConfirming(true)} disabled={state === "loading"}>
        {state === "loading" && <Spinner className="h-4 w-4" />}
        {state === "done" ? "Done" : "Create / Reset Super Admin"}
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void run()}
        title="Create / Reset Super Admin"
        message="This will create (or reset) the Super Admin account with a fixed password. Continue?"
        confirmLabel="Continue"
        danger={false}
      />
    </div>
  );
}

// ── Backfill button ───────────────────────────────────────────────────────────
function BackfillButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setConfirming(false);
    setState("loading");
    try {
      const res = await fetch("/api/admin/backfill-payments", { method: "POST" }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMsg(res.message ?? "Done.");
      setState("done");
      toast.success("Backfill complete.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Backfill failed.");
      setState("error");
      toast.error("Backfill failed.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-dim">
        If enrollments were created before the payment auto-recording fix, run this once to create the missing Payment records so they appear in Finance and Dashboard revenue.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="secondary"
          onClick={() => setConfirming(true)}
          disabled={state === "loading" || state === "done"}
        >
          {state === "loading" && <Spinner className="h-4 w-4" />}
          {state === "loading" ? "Running…" : state === "done" ? "Done" : "Backfill Enrollment Payments"}
        </Button>
        {msg && (
          <p role={state === "error" ? "alert" : undefined} className={cn("text-sm font-medium", state === "error" ? "text-alert" : "text-phos")}>
            {msg}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void run()}
        title="Backfill Enrollment Payments"
        message="This will create Payment records for any enrollment that has an Amount Paid but no linked payment yet. Continue?"
        confirmLabel="Run Backfill"
        danger={false}
      />
    </div>
  );
}

// ── Legacy role migration ─────────────────────────────────────────────────────
function RoleMigrationButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg]     = useState("");
  const [confirming, setConfirming] = useState(false);

  async function migrate() {
    setConfirming(false);
    setState("loading");
    try {
      const res = await fetch("/api/admin/migrate-roles", { method: "POST" }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMsg(res.message ?? "Migration complete.");
      setState("done");
      toast.success("Role migration complete.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Migration failed.");
      setState("error");
      toast.error("Role migration failed.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-dim">
        Converts any account still on the retired &ldquo;staff&rdquo; role to &ldquo;sales&rdquo;.
        Safe to run more than once — it does nothing when no legacy accounts remain.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="secondary"
          onClick={() => setConfirming(true)}
          disabled={state === "loading"}
        >
          {state === "loading" && <Spinner className="h-4 w-4" />}
          {state === "loading" ? "Migrating…" : "Migrate Legacy Roles"}
        </Button>
        {msg && (
          <p role={state === "error" ? "alert" : undefined} className={cn("text-sm font-medium", state === "error" ? "text-danger" : "text-accent")}>
            {msg}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void migrate()}
        title="Migrate Legacy Roles"
        message={'Any user still on the "staff" role will be moved to "sales". Continue?'}
        confirmLabel="Run Migration"
        danger={false}
      />
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
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Academy configuration, staff management, and system tools"
      />

      <div className="space-y-4">
        {/* Academy info */}
        <Section icon={Building2} title="Academy Information">
          {settingsLoading ? (
            <SectionLoading />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Academy Name (English)" htmlFor="academyNameEn">
                <Input id="academyNameEn" value={academy.academyNameEn}
                  onChange={(e) => setAcademy((a) => ({ ...a, academyNameEn: e.target.value }))} />
              </Field>
              <Field label="Academy Name (Arabic)" htmlFor="academyNameAr">
                <Input id="academyNameAr" dir="rtl" value={academy.academyNameAr}
                  onChange={(e) => setAcademy((a) => ({ ...a, academyNameAr: e.target.value }))} />
              </Field>
              <Field label="City" htmlFor="city">
                <Input id="city" value={academy.city}
                  onChange={(e) => setAcademy((a) => ({ ...a, city: e.target.value }))} />
              </Field>
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" value={academy.phone}
                  onChange={(e) => setAcademy((a) => ({ ...a, phone: e.target.value }))} placeholder="+971 6 XXX XXXX" />
              </Field>
              <Field label="WhatsApp Number" htmlFor="whatsappNumber">
                <Input id="whatsappNumber" value={academy.whatsappNumber}
                  onChange={(e) => setAcademy((a) => ({ ...a, whatsappNumber: e.target.value }))} placeholder="+971 50 XXX XXXX" />
              </Field>
              <Field label="Email" htmlFor="academyEmail">
                <Input id="academyEmail" type="email" value={academy.email}
                  onChange={(e) => setAcademy((a) => ({ ...a, email: e.target.value }))} placeholder="info@nitaqacademy.com" />
              </Field>
              <Field label="Website" htmlFor="website">
                <Input id="website" value={academy.website}
                  onChange={(e) => setAcademy((a) => ({ ...a, website: e.target.value }))} placeholder="https://nitaqacademy.com" />
              </Field>
              <Field label="Address" htmlFor="address">
                <Input id="address" value={academy.address}
                  onChange={(e) => setAcademy((a) => ({ ...a, address: e.target.value }))} placeholder="Building, Street, City" />
              </Field>
              <div className="mt-1 sm:col-span-2">
                <Button variant="primary" onClick={() => void saveAcademy()} disabled={academySaving}>
                  {academySaving && <Spinner className="h-4 w-4" />}
                  Save Academy Info
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* Finance defaults */}
        <Section icon={DollarSign} title="Finance Defaults">
          {settingsLoading ? (
            <SectionLoading />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={finance.vatEnabled}
                    aria-label="VAT enabled"
                    onClick={() => setFinance((f) => ({ ...f, vatEnabled: !f.vatEnabled }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:shadow-glow",
                      finance.vatEnabled ? "border-phos bg-phos" : "border-bezel-strong bg-well"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full shadow transition-transform",
                        finance.vatEnabled ? "translate-x-6 bg-phos-ink" : "translate-x-1 bg-faint"
                      )}
                    />
                  </button>
                  <span className="text-sm font-semibold text-ink">
                    VAT Enabled{" "}
                    {finance.vatEnabled
                      ? <Lamp variant="ok">On</Lamp>
                      : <Lamp variant="off">Off</Lamp>}
                  </span>
                </div>
              </div>
              <Field label="VAT Rate (%)" htmlFor="vatRate">
                <Input
                  id="vatRate" type="number" min="0" max="100" step="0.01"
                  value={finance.vatRate}
                  onChange={(e) => setFinance((f) => ({ ...f, vatRate: e.target.value }))}
                  disabled={!finance.vatEnabled}
                />
              </Field>
              <Field label="VAT / TRN Number" htmlFor="vatNumber">
                <Input id="vatNumber" value={finance.vatNumber}
                  onChange={(e) => setFinance((f) => ({ ...f, vatNumber: e.target.value }))}
                  placeholder="TRN..." disabled={!finance.vatEnabled} />
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Select id="currency" value={finance.currency}
                  onChange={(e) => setFinance((f) => ({ ...f, currency: e.target.value }))}>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="GBP">GBP — British Pound</option>
                </Select>
              </Field>
              <Field label="Receipt Prefix" htmlFor="receiptPrefix" help={`Receipts will be numbered: ${finance.receiptPrefix}-0001`}>
                <Input id="receiptPrefix" value={finance.receiptPrefix}
                  onChange={(e) => setFinance((f) => ({ ...f, receiptPrefix: e.target.value }))}
                  placeholder="NITAQ-R" />
              </Field>
              <div className="mt-1 sm:col-span-2">
                <Button variant="primary" onClick={() => void saveFinance()} disabled={financeSaving}>
                  {financeSaving && <Spinner className="h-4 w-4" />}
                  Save Finance Settings
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* Staff accounts */}
        <Section icon={Users} title="Staff Accounts">
          <StaffManagement currentUserId={currentUserId} />
        </Section>

        {/* Legacy data migration */}
        <Section icon={Database} title="Legacy Role Migration">
          <RoleMigrationButton />
        </Section>

        {/* Logo */}
        <Section icon={ImageIcon} title="Academy Logo">
          <div className="space-y-4">
            <p className="text-sm text-dim">
              Upload your academy logo. It will appear in the sidebar. PNG, JPG, or SVG — max 500 KB.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* Preview */}
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-bezel-strong bg-well">
                {logoBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoBase64} alt="Academy Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-faint">
                    <ImageIcon className="h-8 w-8" aria-hidden />
                    <span className="text-[10px] font-medium">No logo</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-3">
                <label className="inline-flex h-9 cursor-pointer select-none items-center justify-center gap-2 rounded-ctl border border-bezel-strong px-4 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-all hover:bg-well">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Choose Image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                </label>

                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => void saveLogo(logoBase64)} disabled={logoSaving}>
                    {logoSaving && <Spinner className="h-3.5 w-3.5" />}
                    Save Logo
                  </Button>
                  {logoBase64 && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => { setLogoBase64(""); void saveLogo(""); }}
                      disabled={logoSaving}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </Button>
                  )}
                </div>

                <p className="text-xs text-faint">Logo is stored securely in the database — no file upload to the server.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Maintenance */}
        <Section icon={Database} title="Maintenance">
          <div className="space-y-6 divide-y divide-bezel">
            <SuperAdminButton />
            <div className="pt-6">
              <BackfillButton />
            </div>
          </div>
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
                <dt className="placard">{k}</dt>
                <dd className="mt-0.5 font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}
