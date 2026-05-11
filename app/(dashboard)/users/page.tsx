"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, Shield, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { ROLE_LABELS, ROLE_COLORS } from "@/config/permissions";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

const ROLES = ["admin", "sales", "teacher", "finance", "academic"];
const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales", phone: "" });

  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (role && role !== "super_admin") router.replace("/dashboard");
  }, [role, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const d = await res.json();
    setUsers(d.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function createUser() {
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "sales", phone: "" });
      fetchUsers();
    } else {
      const d = await res.json();
      alert(d.error || "Failed to create user");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Users & Roles"
        subtitle="Manage system users and their access levels"
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add User
          </button>
        }
      />

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" description="Add team members to get started." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Last Login</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role as keyof typeof ROLE_COLORS] || "bg-slate-100 text-slate-600"}`}>
                      <Shield className="w-3 h-3" />
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500 hidden md:table-cell">{u.phone || "—"}</td>
                  <td className="px-4 py-4 text-slate-400 text-xs hidden lg:table-cell">{u.lastLogin ? formatDate(u.lastLogin) : "Never"}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Add User</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <F label="Full Name *"><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" className={cls} /></F>
              <F label="Email *"><input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="user@nitaq.com" className={cls} /></F>
              <F label="Password *"><input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" className={cls} /></F>
              <F label="Role *">
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={cls}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</option>)}
                </select>
              </F>
              <F label="Phone"><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971..." className={cls} /></F>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={createUser} disabled={saving || !form.name || !form.email || !form.password} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Creating..." : "Create User"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}
