"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Edit2, Trash2, BookMarked } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSubject, setEditSubject] = useState<any>(null);
  const [form, setForm] = useState({ name: "", level: "", active: true });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [courseRes, subjectsRes] = await Promise.all([
      fetch(`/api/courses/${id}`),
      fetch(`/api/subjects?courseId=${id}`),
    ]);
    const courseData = await courseRes.json();
    const subjectsData = await subjectsRes.json();
    setCourse(courseData.course);
    setSubjects(subjectsData.subjects || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditSubject(null);
    setForm({ name: "", level: "", active: true });
    setShowForm(true);
  }

  function openEdit(subject: any) {
    setEditSubject(subject);
    setForm({ name: subject.name, level: subject.level || "", active: subject.active });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editSubject) {
      await fetch(`/api/subjects/${editSubject._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, courseId: id }),
      });
    }
    setShowForm(false);
    fetchData();
    setSaving(false);
  }

  async function deleteSubject(subject: any) {
    if (!confirm(`Delete subject "${subject.name}"?`)) return;
    await fetch(`/api/subjects/${subject._id}`, { method: "DELETE" });
    fetchData();
  }

  if (loading) {
    return <div className="p-6"><div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-4" /><div className="h-64 bg-slate-100 rounded-xl animate-pulse" /></div>;
  }

  if (!course) return <div className="p-6 text-slate-500">Course not found.</div>;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title={course.name}
        subtitle={`${subjects.length} subject${subjects.length !== 1 ? "s" : ""} · ${course.category?.replace("_", " ")}`}
        actions={
          <div className="flex gap-2">
            <Link href="/courses" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4" /> Back to Courses
            </Link>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Course info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoCard label="Online Price" value={`${course.currency} ${course.onlinePrice?.toLocaleString()}`} />
            <InfoCard label="Offline Price" value={`${course.currency} ${course.offlinePrice?.toLocaleString()}`} />
            <InfoCard label="Category" value={course.category?.replace("_", " ")} />
            <InfoCard label="Status" value={course.active ? "Active" : "Inactive"} valueClass={course.active ? "text-green-600" : "text-slate-400"} />
          </div>
          {course.description && <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">{course.description}</p>}
        </div>

        {/* Subjects */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Subjects</h3>
            <button onClick={openCreate} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Subject</button>
          </div>

          {subjects.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="No subjects yet"
              description="Add subjects to this course so teachers can be mapped and leads can be filtered."
              action={<button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Add First Subject</button>}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {subjects.map((subject) => (
                <div key={subject._id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{subject.name}</p>
                    {subject.level && <p className="text-xs text-slate-400">{subject.level}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!subject.active && <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded">Inactive</span>}
                    <button onClick={() => openEdit(subject)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteSubject(subject)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subject modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{editSubject ? "Edit Subject" : "New Subject"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Math, English Reading..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Level (optional)</label>
                <input
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  placeholder="e.g. Beginner, Advanced, Grade 10"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={save} disabled={saving || !form.name.trim()} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : editSubject ? "Update" : "Add Subject"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, valueClass = "text-slate-800" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold capitalize ${valueClass}`}>{value}</p>
    </div>
  );
}
