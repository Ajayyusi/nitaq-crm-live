"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Phone, Mail, Edit2, Save, X } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";

export default function TeacherDetailPage() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState<any>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMapForm, setShowMapForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapForm, setMapForm] = useState({
    courseId: "", subjectId: "", level: "",
    onlineAvailable: true, offlineAvailable: true,
    onlineRate: "", offlineRate: "", paymentType: "per_hour",
  });

  const fetchAll = useCallback(async () => {
    const [teacherRes, mappingsRes, coursesRes] = await Promise.all([
      fetch(`/api/teachers/${id}`),
      fetch(`/api/teacher-subjects?teacherId=${id}`),
      fetch("/api/courses?active=true&withSubjects=true"),
    ]);
    const [td, md, cd] = await Promise.all([teacherRes.json(), mappingsRes.json(), coursesRes.json()]);
    setTeacher(td.teacher);
    setMappings(md.mappings || []);
    setCourses(cd.courses || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const course = courses.find((c: any) => c._id === mapForm.courseId);
    setSubjects(course?.subjects || []);
    setMapForm((f) => ({ ...f, subjectId: "" }));
  }, [mapForm.courseId, courses]);

  async function saveMapping() {
    setSaving(true);
    await fetch("/api/teacher-subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...mapForm,
        teacherId: id,
        onlineRate: parseFloat(mapForm.onlineRate) || 0,
        offlineRate: parseFloat(mapForm.offlineRate) || 0,
      }),
    });
    setShowMapForm(false);
    fetchAll();
    setSaving(false);
  }

  async function deleteMapping(mappingId: string) {
    if (!confirm("Remove this subject mapping?")) return;
    await fetch(`/api/teacher-subjects/${mappingId}`, { method: "DELETE" });
    fetchAll();
  }

  if (loading) return <div className="p-6"><div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-4" /><div className="h-48 bg-slate-100 rounded-xl animate-pulse" /></div>;
  if (!teacher) return <div className="p-6 text-slate-500">Teacher not found.</div>;

  const initials = teacher.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title={teacher.fullName}
        subtitle="Teacher Profile"
        actions={
          <Link href="/teachers" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> Back to Teachers
          </Link>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: profile */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
              {initials}
            </div>
            <h3 className="font-semibold text-slate-800 text-lg">{teacher.fullName}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{teacher.jobTitle || "Teacher"}</p>
            <div className="mt-2"><StatusBadge status={teacher.status} /></div>

            <div className="mt-4 space-y-2 text-left pt-4 border-t border-slate-100">
              {teacher.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-3.5 h-3.5 text-slate-400" />{teacher.phone}</div>}
              {teacher.email && <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="w-3.5 h-3.5 text-slate-400" />{teacher.email}</div>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Details</h4>
            <div className="space-y-2">
              <Row label="Employment" value={teacher.employmentType?.replace("_", " ")} />
              <Row label="Branch Pref." value={teacher.branchPreference || "Any"} />
              {teacher.notes && <Row label="Notes" value={teacher.notes} />}
            </div>
          </div>
        </div>

        {/* Right: subject mappings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Subject Mappings</h3>
                <p className="text-xs text-slate-400 mt-0.5">Subjects this teacher can teach and their rates</p>
              </div>
              <button
                onClick={() => setShowMapForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subject
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No subjects mapped yet. Add subjects to enable allocation.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {mappings.map((m) => (
                  <div key={m._id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.subjectId?.name}</p>
                      <p className="text-xs text-slate-400">{m.courseId?.name}{m.level ? ` · ${m.level}` : ""}</p>
                      <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                        {m.onlineAvailable && <span>Online: <strong className="text-slate-700">AED {m.onlineRate}/hr</strong></span>}
                        {m.offlineAvailable && <span>Offline: <strong className="text-slate-700">AED {m.offlineRate}/hr</strong></span>}
                      </div>
                    </div>
                    <button onClick={() => deleteMapping(m._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add mapping modal */}
      {showMapForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Add Subject Mapping</h2>
              <button onClick={() => setShowMapForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <F label="Course *">
                <select value={mapForm.courseId} onChange={(e) => setMapForm((f) => ({ ...f, courseId: e.target.value }))} className={icls}>
                  <option value="">Select course...</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </F>
              <F label="Subject *">
                <select value={mapForm.subjectId} onChange={(e) => setMapForm((f) => ({ ...f, subjectId: e.target.value }))} disabled={!subjects.length} className={icls}>
                  <option value="">Select subject...</option>
                  {subjects.map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </F>
              <F label="Level (optional)">
                <input value={mapForm.level} onChange={(e) => setMapForm((f) => ({ ...f, level: e.target.value }))} placeholder="e.g. Advanced" className={icls} />
              </F>
              <div className="grid grid-cols-2 gap-4">
                <F label="Online Rate (AED/hr)">
                  <input type="number" min="0" value={mapForm.onlineRate} onChange={(e) => setMapForm((f) => ({ ...f, onlineRate: e.target.value }))} placeholder="0" className={icls} />
                </F>
                <F label="Offline Rate (AED/hr)">
                  <input type="number" min="0" value={mapForm.offlineRate} onChange={(e) => setMapForm((f) => ({ ...f, offlineRate: e.target.value }))} placeholder="0" className={icls} />
                </F>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={mapForm.onlineAvailable} onChange={(e) => setMapForm((f) => ({ ...f, onlineAvailable: e.target.checked }))} className="rounded" />
                  Online Available
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={mapForm.offlineAvailable} onChange={(e) => setMapForm((f) => ({ ...f, offlineAvailable: e.target.checked }))} className="rounded" />
                  Offline Available
                </label>
              </div>
              <F label="Payment Type">
                <select value={mapForm.paymentType} onChange={(e) => setMapForm((f) => ({ ...f, paymentType: e.target.value }))} className={icls}>
                  <option value="per_hour">Per Hour</option>
                  <option value="per_session">Per Session</option>
                  <option value="per_day">Per Day</option>
                  <option value="monthly">Monthly</option>
                </select>
              </F>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={saveMapping} disabled={saving || !mapForm.courseId || !mapForm.subjectId} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? "Saving..." : "Add Mapping"}
              </button>
              <button onClick={() => setShowMapForm(false)} className="px-4 py-2.5 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const icls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 capitalize font-medium">{value}</span>
    </div>
  );
}
