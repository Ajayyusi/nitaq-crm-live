"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Edit3, Loader2, Plus, Search, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { courseCategories, courseStatuses, batchFormats } from "@/constants/modelConstants";

type Batch = {
  id: string; batchId: string; batchName: string; startDate: string; endDate: string;
  schedule: string; format: string; trainerName: string; maxStudents: number | null; status: string;
};

type Course = {
  id: string; courseCode: string; courseName: string; category: string; description: string;
  durationWeeks: number | null; totalSessions: number | null; sessionsPerWeek: number | null;
  hoursPerSession: number | null; totalHours: number | null; priceExVat: number; vatRate: number;
  priceInclVat: number; maxStudentsPerBatch: number | null; status: string; speaActivity: string;
  batches: Batch[];
};

type FormState = {
  courseName: string; courseCode: string; category: string; description: string;
  durationWeeks: string; totalSessions: string; sessionsPerWeek: string; hoursPerSession: string;
  priceExVat: string; vatRate: string; maxStudentsPerBatch: string; status: string; speaActivity: string;
};

const emptyForm: FormState = {
  courseName: "", courseCode: "", category: "Computer Software Training",
  description: "", durationWeeks: "", totalSessions: "", sessionsPerWeek: "",
  hoursPerSession: "", priceExVat: "", vatRate: "5", maxStudentsPerBatch: "", status: "Active", speaActivity: "",
};

function getErr(v: unknown, fb: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string") return v.message;
  return fb;
}

const statusColors: Record<string, string> = {
  Active: "bg-[#E8F5E9] text-[#2E7D32] ring-green-200",
  "Coming Soon": "bg-amber-50 text-amber-800 ring-amber-200",
  Inactive: "bg-slate-100 text-slate-600 ring-slate-200",
};

const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/courses?${params}`, { cache: "no-store" });
      const data = await res.json();
      setCourses(data.courses ?? []);
    } catch { setError("Failed to load courses."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [search, statusFilter]);

  function openCreate() {
    setEditingCourse(null); setForm(emptyForm); setFormError(""); setDrawerOpen(true);
  }
  function openEdit(c: Course) {
    setEditingCourse(c);
    setForm({
      courseName: c.courseName, courseCode: c.courseCode, category: c.category,
      description: c.description, durationWeeks: c.durationWeeks?.toString() ?? "",
      totalSessions: c.totalSessions?.toString() ?? "", sessionsPerWeek: c.sessionsPerWeek?.toString() ?? "",
      hoursPerSession: c.hoursPerSession?.toString() ?? "", priceExVat: c.priceExVat.toString(),
      vatRate: c.vatRate.toString(), maxStudentsPerBatch: c.maxStudentsPerBatch?.toString() ?? "",
      status: c.status, speaActivity: c.speaActivity,
    });
    setFormError(""); setDrawerOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError("");
    try {
      const body = {
        ...form,
        durationWeeks: form.durationWeeks || undefined,
        totalSessions: form.totalSessions || undefined,
        sessionsPerWeek: form.sessionsPerWeek || undefined,
        hoursPerSession: form.hoursPerSession || undefined,
        priceExVat: form.priceExVat || 0,
        vatRate: form.vatRate || 5,
        maxStudentsPerBatch: form.maxStudentsPerBatch || undefined,
      };
      const url = editingCourse ? `/api/courses/${editingCourse.id}` : "/api/courses";
      const method = editingCourse ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingCourse ? "Course updated." : "Course created.");
      setDrawerOpen(false);
      await load();
    } catch (caught) { setFormError(getErr(caught, "Failed to save course.")); }
    finally { setSaving(false); }
  }

  async function deleteCourse(c: Course) {
    if (!window.confirm(`Delete "${c.courseName}"?`)) return;
    try {
      await fetch(`/api/courses/${c.id}`, { method: "DELETE" });
      setNotice("Course deleted.");
      await load();
    } catch { setError("Failed to delete course."); }
  }

  return (
    <>
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[#0D1F0E]/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[580px] flex-col bg-white shadow-2xl">
            <div className="border-b bg-[#0D1F0E] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4DB6AC]">Courses</p>
                  <h2 className="mt-1 text-xl font-bold">{editingCourse ? "Edit Course" : "Add Course"}</h2>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <form onSubmit={save} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 p-6">
                {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Course name *</label>
                    <input required value={form.courseName} onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))} className={inp} placeholder="e.g. AI for Professionals" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Course code</label>
                    <input value={form.courseCode} onChange={(e) => setForm((f) => ({ ...f, courseCode: e.target.value }))} className={inp} placeholder="Auto-generated if blank" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Category *</label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inp}>
                      {courseCategories.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Price (AED excl. VAT)</label>
                    <input type="number" min="0" value={form.priceExVat} onChange={(e) => setForm((f) => ({ ...f, priceExVat: e.target.value }))} className={inp} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">VAT rate (%)</label>
                    <input type="number" min="0" max="100" value={form.vatRate} onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Duration (weeks)</label>
                    <input type="number" min="1" value={form.durationWeeks} onChange={(e) => setForm((f) => ({ ...f, durationWeeks: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Total sessions</label>
                    <input type="number" min="1" value={form.totalSessions} onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Sessions / week</label>
                    <input type="number" min="1" value={form.sessionsPerWeek} onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Hours / session</label>
                    <input type="number" min="0.5" step="0.5" value={form.hoursPerSession} onChange={(e) => setForm((f) => ({ ...f, hoursPerSession: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Max students / batch</label>
                    <input type="number" min="1" value={form.maxStudentsPerBatch} onChange={(e) => setForm((f) => ({ ...f, maxStudentsPerBatch: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inp}>
                      {courseStatuses.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">SPEA activity</label>
                    <input value={form.speaActivity} onChange={(e) => setForm((f) => ({ ...f, speaActivity: e.target.value }))} className={inp} placeholder="Licensed activity name" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                    <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inp} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-5">
                <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCourse ? "Save Changes" : "Create Course"}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">Academy Ops</p>
              <h1 className="mt-2 text-3xl font-bold text-[#0D1F0E]">Courses</h1>
              <p className="mt-2 text-sm text-slate-500">Manage the course catalog, pricing, and batch scheduling.</p>
            </div>
            <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2E7D32] px-5 text-sm font-bold text-white shadow transition hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> Add Course
            </button>
          </div>
        </section>

        {(notice || error) && (
          <div className="space-y-2">
            {notice && <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]"><span>{notice}</span><button onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
            {error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><span>{error}</span><button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}
          </div>
        )}

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..." />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#2E7D32]">
            <option value="all">All statuses</option>
            {courseStatuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" />
              <span className="text-sm font-semibold">Loading...</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]"><BookOpen className="h-6 w-6" /></div>
              <p className="text-lg font-bold text-[#0D1F0E]">No courses yet</p>
              <button onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />Add Course</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {courses.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[#0D1F0E]">{c.courseName}</p>
                        <span className="font-mono text-xs text-slate-400">{c.courseCode}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${statusColors[c.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>{c.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{c.category}</span>
                        <span>·</span>
                        <span>AED {c.priceExVat.toLocaleString()} + VAT → AED {c.priceInclVat.toLocaleString()}</span>
                        {c.totalSessions && <><span>·</span><span>{c.totalSessions} sessions</span></>}
                        <span>·</span>
                        <span>{c.batches.length} batch{c.batches.length !== 1 ? "es" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="Toggle batches">
                        {expandedId === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button onClick={() => openEdit(c)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => void deleteCourse(c)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {expandedId === c.id && (
                    <div className="border-t border-slate-100 bg-slate-50 px-8 py-4">
                      {c.batches.length === 0 ? (
                        <p className="text-sm text-slate-500">No batches yet. Add via the course edit form.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {c.batches.map((b) => (
                            <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-[#0D1F0E]">{b.batchName}</p>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{b.status}</span>
                              </div>
                              <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                                {b.trainerName && <p>Trainer: {b.trainerName}</p>}
                                {b.schedule && <p>{b.schedule}</p>}
                                {b.startDate && <p>{b.startDate} → {b.endDate}</p>}
                                <p>{b.format}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
