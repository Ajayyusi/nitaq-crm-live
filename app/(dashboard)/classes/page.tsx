"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, BookOpen, Users, CheckCircle2, X, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { courseList } from "@/constants/leads";
import { attendanceStatuses } from "@/constants/modelConstants";

type AttRecord = {
  enrollmentId: string; studentName: string; status: string; notes: string;
};

type Session = {
  id: string; course: string; batchName: string; sessionDate: string;
  sessionNumber: number | null; topic: string; trainerName: string;
  records: AttRecord[]; presentCount: number; totalCount: number; attendancePct: number;
};

type Enrollment = {
  id: string; fullName: string; phone: string; course: string; status: string;
};

const today = new Date().toISOString().slice(0, 10);

const statusColor: Record<string, string> = {
  Present: "bg-[#E8F5E9] text-[#1B5E20]",
  Late: "bg-amber-50 text-amber-700",
  Absent: "bg-red-50 text-red-700",
  Excused: "bg-slate-100 text-slate-500",
};

const cls =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const BLANK_SESSION = {
  course: "", batchName: "", sessionDate: today,
  sessionNumber: "", topic: "", trainerName: "",
};

export default function ClassesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [form, setForm] = useState({ ...BLANK_SESSION });
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseFilter !== "All") params.set("course", courseFilter);
      const res = await fetch(`/api/attendance?${params}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      setError("Could not load sessions. Please check your connection.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [courseFilter]);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch("/api/enrollments?status=Active");
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setEnrollments([]);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  function openNew() {
    setEditTarget(null);
    setForm({ ...BLANK_SESSION });
    setRecords([]);
    setError("");
    setDrawerOpen(true);
  }

  function openEdit(s: Session) {
    setEditTarget(s);
    setForm({
      course: s.course, batchName: s.batchName, sessionDate: s.sessionDate,
      sessionNumber: s.sessionNumber != null ? String(s.sessionNumber) : "",
      topic: s.topic, trainerName: s.trainerName,
    });
    setRecords(s.records.map((r) => ({ ...r })));
    setError("");
    setDrawerOpen(true);
  }

  function loadEnrolleesForCourse(course: string) {
    if (!course) return;
    const matched = enrollments.filter((e) => e.course === course && e.status === "Active");
    setRecords(
      matched.map((e) => ({
        enrollmentId: e.id,
        studentName: e.fullName,
        status: "Present",
        notes: "",
      }))
    );
  }

  function updateRecord(idx: number, field: keyof AttRecord, value: string) {
    setRecords((rs) => rs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function markAll(status: string) {
    setRecords((rs) => rs.map((r) => ({ ...r, status })));
  }

  async function save() {
    if (!form.course) { setError("Course is required."); return; }
    if (!form.sessionDate) { setError("Session date is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        sessionNumber: form.sessionNumber ? Number(form.sessionNumber) : undefined,
        records,
      };
      const url = editTarget ? `/api/attendance/${editTarget.id}` : "/api/attendance";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (res.message && !res.session) throw new Error(res.message);
      setDrawerOpen(false);
      fetchSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save session.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(s: Session) {
    const label = s.sessionNumber ? `Session ${s.sessionNumber}` : `session on ${s.sessionDate}`;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/attendance/${s.id}`, { method: "DELETE" });
      void fetchSessions();
    } catch {
      setError("Failed to delete session.");
    }
  }

  const totals = {
    sessions: sessions.length,
    students: sessions.reduce((sum, s) => sum + s.totalCount, 0),
    present: sessions.reduce((sum, s) => sum + s.presentCount, 0),
  };
  const avgAtt = totals.students > 0 ? Math.round((totals.present / totals.students) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Classes & Attendance"
        subtitle="Record sessions and track student attendance"
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] text-white text-sm font-medium rounded-lg hover:bg-[#1B5E20] transition"
          >
            <Plus className="w-4 h-4" /> Record Session
          </button>
        }
      />

      {/* KPI cards */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: "Sessions", value: totals.sessions, cls: "text-[#2E7D32]" },
          { icon: Users, label: "Attendance Records", value: totals.students, cls: "text-teal-600" },
          { icon: CheckCircle2, label: "Present Rate", value: `${avgAtt}%`, cls: avgAtt >= 80 ? "text-[#2E7D32]" : avgAtt >= 60 ? "text-amber-600" : "text-red-600" },
          { icon: BookOpen, label: "Absences", value: totals.students - totals.present, cls: "text-red-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
              <k.icon className={`w-4 h-4 ${k.cls}`} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{k.label}</p>
              <p className={`text-sm font-bold ${k.cls}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Course filter */}
      <div className="px-6 pb-3 flex gap-2 flex-wrap">
        {["All", ...courseList].map((c) => (
          <button
            key={c}
            onClick={() => setCourseFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
              courseFilter === c
                ? "bg-[#2E7D32] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:text-[#2E7D32]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      <div className="flex-1 px-6 pb-8 overflow-auto">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No sessions recorded"
            description="Record your first class session and mark attendance."
            action={
              <button onClick={openNew} className="px-4 py-2 bg-[#2E7D32] text-white text-sm rounded-lg">
                Record Session
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const expanded = expandedId === s.id;
              return (
                <div key={s.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Session header row */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    <button
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                      className="text-slate-400 hover:text-[#2E7D32] transition"
                    >
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#0D1F0E] text-sm">
                          {s.sessionNumber ? `Session ${s.sessionNumber} — ` : ""}{s.course}
                        </span>
                        {s.batchName && (
                          <span className="text-xs bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full">{s.batchName}</span>
                        )}
                        {s.topic && <span className="text-xs text-slate-400">{s.topic}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400">{s.sessionDate}</span>
                        {s.trainerName && <span className="text-xs text-slate-400">· {s.trainerName}</span>}
                      </div>
                    </div>

                    {/* Attendance pill */}
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span className={`px-2 py-0.5 rounded-full ${s.attendancePct >= 80 ? "bg-[#E8F5E9] text-[#1B5E20]" : s.attendancePct >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                        {s.presentCount}/{s.totalCount} present ({s.attendancePct}%)
                      </span>
                    </div>

                    <button
                      onClick={() => openEdit(s)}
                      className="text-xs text-[#2E7D32] hover:underline font-medium px-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSession(s)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expanded records */}
                  {expanded && s.records.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 uppercase tracking-wide">
                            <th className="text-left py-1 pr-4 font-semibold">Student</th>
                            <th className="text-left py-1 pr-4 font-semibold">Status</th>
                            <th className="text-left py-1 font-semibold">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {s.records.map((r, i) => (
                            <tr key={i}>
                              <td className="py-1.5 pr-4 text-[#0D1F0E] font-medium">{r.studentName}</td>
                              <td className="py-1.5 pr-4">
                                <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-1.5 text-slate-400">{r.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#0D1F0E]">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {editTarget ? "Edit Session" : "Record Session"}
                </h2>
                <p className="text-xs text-white/60">
                  {editTarget ? "Update attendance records" : "Mark attendance for a class session"}
                </p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* Session details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Course *">
                    <select
                      className={cls}
                      value={form.course}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, course: e.target.value }));
                        if (!editTarget) loadEnrolleesForCourse(e.target.value);
                      }}
                    >
                      <option value="">— Select course —</option>
                      {courseList.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Batch Name">
                  <input
                    className={cls}
                    value={form.batchName}
                    onChange={(e) => setForm((f) => ({ ...f, batchName: e.target.value }))}
                    placeholder="e.g. Batch A"
                  />
                </Field>
                <Field label="Session No.">
                  <input
                    className={cls}
                    type="number"
                    min="1"
                    value={form.sessionNumber}
                    onChange={(e) => setForm((f) => ({ ...f, sessionNumber: e.target.value }))}
                    placeholder="1"
                  />
                </Field>
                <Field label="Session Date *">
                  <input
                    className={cls}
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))}
                  />
                </Field>
                <Field label="Trainer">
                  <input
                    className={cls}
                    value={form.trainerName}
                    onChange={(e) => setForm((f) => ({ ...f, trainerName: e.target.value }))}
                    placeholder="Trainer name"
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="Topic / Agenda">
                    <input
                      className={cls}
                      value={form.topic}
                      onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                      placeholder="What was covered?"
                    />
                  </Field>
                </div>
              </div>

              {/* Attendance records */}
              {records.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-[#0D1F0E]">
                      Attendance ({records.length} students)
                    </p>
                    <div className="flex gap-2">
                      {attendanceStatuses.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => markAll(s)}
                          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
                        >
                          All {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Student</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Status</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {records.map((r, i) => (
                            <tr key={i} className={`${r.status === "Absent" ? "bg-red-50/40" : r.status === "Late" ? "bg-amber-50/40" : ""}`}>
                              <td className="px-3 py-2 font-medium text-[#0D1F0E]">{r.studentName}</td>
                              <td className="px-3 py-2">
                                <select
                                  className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                                  value={r.status}
                                  onChange={(e) => updateRecord(i, "status", e.target.value)}
                                >
                                  {attendanceStatuses.map((s) => <option key={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  className="w-full text-xs border-0 bg-transparent focus:outline-none text-slate-500 placeholder:text-slate-300"
                                  placeholder="optional note"
                                  value={r.notes}
                                  onChange={(e) => updateRecord(i, "notes", e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {records.filter((r) => r.status === "Present").length} present ·{" "}
                    {records.filter((r) => r.status === "Absent").length} absent ·{" "}
                    {records.filter((r) => r.status === "Late").length} late
                  </p>
                </div>
              )}

              {records.length === 0 && form.course && (
                <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400">
                    No active enrollments found for this course. Students will appear automatically once enrolled.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#2E7D32] text-white text-sm font-semibold rounded-lg hover:bg-[#1B5E20] transition disabled:opacity-50"
              >
                {saving ? "Saving…" : editTarget ? "Update Session" : "Save Attendance"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
