"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, BookOpen, Edit2, Trash2, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { formatCurrency } from "@/lib/utils";

const CATEGORIES = [
  { value: "test_prep", label: "Test Prep" },
  { value: "language", label: "Language" },
  { value: "school_support", label: "School Support" },
  { value: "professional", label: "Professional" },
  { value: "other", label: "Other" },
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCourse, setEditCourse] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", category: "test_prep", description: "",
    onlinePrice: "", offlinePrice: "", currency: "AED", active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/courses?withSubjects=true");
    const d = await res.json();
    setCourses(d.courses || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  function openCreate() {
    setEditCourse(null);
    setForm({ name: "", category: "test_prep", description: "", onlinePrice: "", offlinePrice: "", currency: "AED", active: true });
    setShowForm(true);
  }

  function openEdit(course: any) {
    setEditCourse(course);
    setForm({
      name: course.name,
      category: course.category,
      description: course.description || "",
      onlinePrice: String(course.onlinePrice),
      offlinePrice: String(course.offlinePrice),
      currency: course.currency,
      active: course.active,
    });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const body = {
      ...form,
      onlinePrice: parseFloat(form.onlinePrice) || 0,
      offlinePrice: parseFloat(form.offlinePrice) || 0,
      defaultPrice: parseFloat(form.offlinePrice) || 0,
    };
    const url = editCourse ? `/api/courses/${editCourse._id}` : "/api/courses";
    const method = editCourse ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(false); fetchCourses(); }
    setSaving(false);
  }

  async function toggleActive(course: any) {
    await fetch(`/api/courses/${course._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !course.active }),
    });
    fetchCourses();
  }

  async function deleteCourse(course: any) {
    if (!confirm(`Delete "${course.name}"? This cannot be undone.`)) return;
    await fetch(`/api/courses/${course._id}`, { method: "DELETE" });
    fetchCourses();
  }

  const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label || v;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Courses"
        subtitle="Manage all academy courses and pricing"
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add Course
          </button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Create your first course to start managing subjects and pricing."
            action={<button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Add First Course</button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div key={course._id} className={`bg-white rounded-xl border ${course.active ? "border-slate-200" : "border-slate-100 opacity-60"} p-5 hover:shadow-sm transition-shadow`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate">{course.name}</h3>
                      {!course.active && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">{catLabel(course.category)}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => openEdit(course)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(course)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition">
                      {course.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteCourse(course)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {course.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{course.description}</p>}

                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-slate-400">Online</p>
                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(course.onlinePrice, course.currency)}</p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-slate-400">Offline</p>
                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(course.offlinePrice, course.currency)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{course.subjects?.length || 0} subject{course.subjects?.length !== 1 ? "s" : ""}</span>
                  <Link href={`/courses/${course._id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Manage Subjects <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{editCourse ? "Edit Course" : "New Course"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Course Name *">
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. SAT Preparation" className={cls} />
              </Field>
              <Field label="Category *">
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={cls}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Short description..." className={cls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Online Price (AED)">
                  <input type="number" min="0" value={form.onlinePrice} onChange={(e) => setForm((f) => ({ ...f, onlinePrice: e.target.value }))} placeholder="0" className={cls} />
                </Field>
                <Field label="Offline Price (AED)">
                  <input type="number" min="0" value={form.offlinePrice} onChange={(e) => setForm((f) => ({ ...f, offlinePrice: e.target.value }))} placeholder="0" className={cls} />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-700">Active (visible to sales)</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={save} disabled={saving || !form.name} className="flex-1 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : editCourse ? "Update Course" : "Create Course"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}
