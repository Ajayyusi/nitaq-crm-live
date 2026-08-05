"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import HoursProgress from "@/components/shared/HoursProgress";

export interface RegistrationInfo {
  id: string;
  fullName: string;
  course: string;
  teacherName: string;
  totalRegisteredHours: number;
  completedHours: number;
  remainingHours: number;
}

interface Session {
  id: string; classDate: string; startTime: string; endTime: string;
  deliveredHours: number; attendanceStatus: string; classStatus: string;
  isChargeable: boolean; lessonTopic: string; notes: string; homework: string;
  teacherName: string; recordedBy: string; createdAt: string;
}

const attendanceOptions = ["Present", "Absent", "Late", "Excused"];
const classStatusOptions = ["Completed", "Scheduled", "Cancelled", "No Show"];

const attBadge: Record<string, string> = {
  Present: "bg-emerald-100 text-emerald-700",
  Late: "bg-amber-100 text-amber-700",
  Absent: "bg-red-100 text-red-700",
  Excused: "bg-slate-100 text-slate-600",
};
const statusBadge: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Cancelled: "bg-slate-100 text-slate-500",
  "No Show": "bg-red-100 text-red-700",
};

const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

/**
 * Class History + Record Class drawer for one course registration.
 * `canManage` (admin/manager) unlocks edit/delete, chargeable override and
 * hour adjustments; teachers get record-only for their own students
 * (enforced again server-side).
 */
export default function ClassHistoryDrawer({
  registration, onClose, canManage, onHoursChanged,
}: {
  registration: RegistrationInfo;
  onClose: () => void;
  canManage: boolean;
  onHoursChanged?: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [reg, setReg] = useState(registration);
  const [view, setView] = useState<"history" | "record" | "adjust">("history");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const blankForm = {
    classDate: new Date().toISOString().slice(0, 10),
    startTime: "", endTime: "", deliveredHours: "",
    attendanceStatus: "Present", classStatus: "Completed",
    isChargeable: false, lessonTopic: "", notes: "", homework: "",
  };
  const [form, setForm] = useState({ ...blankForm });
  const [adjForm, setAdjForm] = useState({ adjustmentType: "Add Hours", hours: "", reason: "" });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/class-sessions?enrollmentId=${registration.id}`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [registration.id]);

  useEffect(load, [load]);

  const refreshHours = (hours?: { completedHours: number; remainingHours: number } | null) => {
    if (hours) setReg((r) => ({ ...r, completedHours: hours.completedHours, remainingHours: hours.remainingHours }));
    onHoursChanged?.();
  };

  // Auto-compute delivered hours from times
  const autoHours = (start: string, end: string) => {
    if (!start || !end) return;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em - sh * 60 - sm) / 60;
    if (diff > 0) setForm((f) => ({ ...f, deliveredHours: String(Math.round(diff * 100) / 100) }));
  };

  const openRecord = () => { setForm({ ...blankForm }); setEditingId(null); setError(""); setView("record"); };
  const openEdit = (s: Session) => {
    setForm({
      classDate: s.classDate, startTime: s.startTime, endTime: s.endTime,
      deliveredHours: String(s.deliveredHours), attendanceStatus: s.attendanceStatus,
      classStatus: s.classStatus, isChargeable: s.isChargeable,
      lessonTopic: s.lessonTopic, notes: s.notes, homework: s.homework,
    });
    setEditingId(s.id); setError(""); setView("record");
  };

  const submit = async () => {
    setSaving(true); setError(""); setOkMsg("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
        deliveredHours: Number(form.deliveredHours) || 0,
        enrollmentId: registration.id,
      };
      const url = editingId ? `/api/class-sessions/${editingId}` : "/api/class-sessions";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      refreshHours(d.hours);
      setOkMsg(editingId ? "Class updated." : "Class recorded.");
      setView("history");
      load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const deleteSession = async (s: Session) => {
    if (!confirm(`Delete the ${s.deliveredHours}h class on ${s.classDate}? Hours will be recalculated.`)) return;
    try {
      const res = await fetch(`/api/class-sessions/${s.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      refreshHours(d.hours);
      load();
    } catch (err) { alert((err as Error).message); }
  };

  const submitAdjust = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/hour-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...adjForm, hours: Number(adjForm.hours) || 0, enrollmentId: registration.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      refreshHours(d.hours);
      setOkMsg("Adjustment recorded.");
      setAdjForm({ adjustmentType: "Add Hours", hours: "", reason: "" });
      setView("history");
      load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const completedCount = sessions.filter((s) => s.classStatus === "Completed").length;
  const attended = sessions.filter((s) => s.classStatus === "Completed" && ["Present", "Late"].includes(s.attendanceStatus)).length;
  const attendancePct = completedCount > 0 ? Math.round((attended / completedCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">{reg.fullName}</h2>
            <p className="text-xs text-gray-500">{reg.course}{reg.teacherName ? ` · Teacher: ${reg.teacherName}` : ""}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {okMsg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-400">{okMsg}</p>}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Registered", `${reg.totalRegisteredHours || 0}h`],
              ["Completed", `${reg.completedHours}h`],
              ["Remaining", `${reg.remainingHours}h`],
              ["Attendance", `${attendancePct}%`],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-white/10 dark:bg-white/5">
                <p className="text-lg font-extrabold text-gray-900 dark:text-white">{v}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{l}</p>
              </div>
            ))}
          </div>
          <HoursProgress total={reg.totalRegisteredHours} completed={reg.completedHours} />

          {/* Actions */}
          {view === "history" && (
            <div className="flex flex-wrap gap-2">
              <button onClick={openRecord} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
                <Plus className="h-4 w-4" /> Record Class
              </button>
              {canManage && (
                <button onClick={() => { setError(""); setView("adjust"); }} className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300">
                  Adjust Hours
                </button>
              )}
            </div>
          )}

          {/* Record / edit class form */}
          {view === "record" && (
            <div className="space-y-3 rounded-xl border border-[#2E7D32]/30 bg-green-50/40 p-4 dark:bg-green-950/10">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{editingId ? "Edit Class Record" : "Record a Class"}</p>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lblx">Class Date *</label><DatePicker value={form.classDate} onChange={(v) => setForm((f) => ({ ...f, classDate: v }))} required /></div>
                <div><label className="lblx">Delivered Hours *</label>
                  <input type="number" step="0.25" min="0.25" value={form.deliveredHours}
                    onChange={(e) => setForm((f) => ({ ...f, deliveredHours: e.target.value }))} className={inp} placeholder="e.g. 2" />
                </div>
                <div><label className="lblx">Start Time</label>
                  <input type="time" value={form.startTime}
                    onChange={(e) => { setForm((f) => ({ ...f, startTime: e.target.value })); autoHours(e.target.value, form.endTime); }} className={inp} />
                </div>
                <div><label className="lblx">End Time</label>
                  <input type="time" value={form.endTime}
                    onChange={(e) => { setForm((f) => ({ ...f, endTime: e.target.value })); autoHours(form.startTime, e.target.value); }} className={inp} />
                </div>
                <div><label className="lblx">Attendance</label>
                  <select value={form.attendanceStatus} onChange={(e) => setForm((f) => ({ ...f, attendanceStatus: e.target.value }))} className={inp}>
                    {attendanceOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className="lblx">Class Status</label>
                  <select value={form.classStatus} onChange={(e) => setForm((f) => ({ ...f, classStatus: e.target.value }))} className={inp}>
                    {classStatusOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="lblx">Lesson Topic</label><input value={form.lessonTopic} onChange={(e) => setForm((f) => ({ ...f, lessonTopic: e.target.value }))} className={inp} /></div>
              <div><label className="lblx">Class Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>
              <div><label className="lblx">Homework / Next Steps</label><input value={form.homework} onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))} className={inp} /></div>
              {canManage && ["Absent", "No Show"].includes(form.classStatus === "No Show" ? "No Show" : form.attendanceStatus) && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isChargeable} onChange={(e) => setForm((f) => ({ ...f, isChargeable: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
                  <span className="text-gray-700 dark:text-gray-300">Chargeable (deduct hours even though the student was absent / no-show)</span>
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving} className="flex-1 rounded-lg bg-[#2E7D32] py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Save Class"}
                </button>
                <button onClick={() => setView("history")} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 dark:border-white/10 dark:text-gray-400">Cancel</button>
              </div>
            </div>
          )}

          {/* Hour adjustment (admin/manager) */}
          {view === "adjust" && canManage && (
            <div className="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50/50 p-4 dark:bg-amber-950/10">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Hour Adjustment (audited)</p>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lblx">Type</label>
                  <select value={adjForm.adjustmentType} onChange={(e) => setAdjForm((f) => ({ ...f, adjustmentType: e.target.value }))} className={inp}>
                    <option>Add Hours</option><option>Deduct Hours</option><option>Correction</option>
                  </select>
                </div>
                <div><label className="lblx">Hours *</label>
                  <input type="number" step="0.25" min="0.25" value={adjForm.hours} onChange={(e) => setAdjForm((f) => ({ ...f, hours: e.target.value }))} className={inp} />
                </div>
              </div>
              <div><label className="lblx">Reason (required)</label><input value={adjForm.reason} onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))} className={inp} placeholder="Why is this adjustment needed?" /></div>
              <div className="flex gap-2">
                <button onClick={submitAdjust} disabled={saving || !adjForm.reason.trim()} className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                  {saving ? "Saving…" : "Apply Adjustment"}
                </button>
                <button onClick={() => setView("history")} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 dark:border-white/10 dark:text-gray-400">Cancel</button>
              </div>
            </div>
          )}

          {/* History table */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Class History ({sessions.length})</p>
            {loading ? (
              <div className="flex h-24 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-white/10">No classes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{s.classDate}</span>
                      {(s.startTime || s.endTime) && <span className="text-xs text-gray-400">{s.startTime}–{s.endTime}</span>}
                      <span className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-300">{s.deliveredHours}h</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${attBadge[s.attendanceStatus] ?? ""}`}>{s.attendanceStatus}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge[s.classStatus] ?? ""}`}>{s.classStatus}</span>
                      {s.isChargeable && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Chargeable</span>}
                      <span className="flex-1" />
                      {canManage && (
                        <span className="flex gap-1">
                          <button onClick={() => openEdit(s)} className="rounded p-1 text-gray-300 hover:text-[#2E7D32]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteSession(s)} className="rounded p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      )}
                    </div>
                    {s.lessonTopic && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400"><strong>Topic:</strong> {s.lessonTopic}</p>}
                    {s.notes && <p className="mt-0.5 text-xs text-gray-500">{s.notes}</p>}
                    {s.homework && <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400"><strong>Homework:</strong> {s.homework}</p>}
                    <p className="mt-1 text-[10px] text-gray-400">Teacher: {s.teacherName} · Recorded by {s.recordedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
      <style>{`.lblx { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
