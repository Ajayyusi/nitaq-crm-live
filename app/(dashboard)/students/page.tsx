"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, GraduationCap, Phone, Mail, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "", phone: "", parentPhone: "", email: "",
    school: "", grade: "", notes: "",
  });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/students?${params}`);
    const d = await res.json();
    setStudents(d.students || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => {
    const t = setTimeout(fetchStudents, 400);
    return () => clearTimeout(t);
  }, [search]);

  async function save() {
    if (!form.fullName || !form.phone) return;
    setSaving(true);
    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ fullName: "", phone: "", parentPhone: "", email: "", school: "", grade: "", notes: "" });
    fetchStudents();
    setSaving(false);
  }

  const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Students"
        subtitle={`${students.length} active students`}
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        }
      />

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1 max-w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm placeholder-slate-400 outline-none w-full"
          />
        </div>
        <button onClick={fetchStudents} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students yet"
            description="Add students to start managing enrollments."
            action={<button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Add First Student</button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">School</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {s.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800">{s.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{s.phone}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-500 hidden md:table-cell">
                    {s.email ? <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{s.email}</div> : "—"}
                  </td>
                  <td className="px-4 py-4 text-slate-500 hidden lg:table-cell">{s.school || "—"}</td>
                  <td className="px-4 py-4 text-slate-500 hidden lg:table-cell">{s.grade || "—"}</td>
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
              <h2 className="text-lg font-semibold">Add Student</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Full Name *"><input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Student name" className={cls} /></F>
                <F label="Phone *"><input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971..." className={cls} /></F>
                <F label="Parent Phone"><input value={form.parentPhone} onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value }))} placeholder="+971..." className={cls} /></F>
                <F label="Email"><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email..." className={cls} /></F>
                <F label="School"><input value={form.school} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} placeholder="School name" className={cls} /></F>
                <F label="Grade"><input value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} placeholder="e.g. Grade 10" className={cls} /></F>
              </div>
              <F label="Notes"><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={cls} /></F>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={save} disabled={saving || !form.fullName || !form.phone} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : "Add Student"}
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
