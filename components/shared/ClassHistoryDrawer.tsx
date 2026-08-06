"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import HoursProgress from "@/components/shared/HoursProgress";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Drawer, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { LoadError, Skeleton } from "@/components/ui/feedback";
import { Pagination, usePagination } from "@/components/ui/table";

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

/* Session states mapped to the annunciator vocabulary. */
const ATT_LAMP: Record<string, LampVariant> = {
  Present: "ok",
  Late: "caution",
  Absent: "alert",
  Excused: "off",
};
const CLASS_LAMP: Record<string, LampVariant> = {
  Completed: "ok",
  Scheduled: "advisory",
  Cancelled: "off",
  "No Show": "alert",
};

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [reg, setReg] = useState(registration);
  const [view, setView] = useState<"history" | "record" | "adjust">("history");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setLoadFailed(false);
    fetch(`/api/class-sessions?enrollmentId=${registration.id}`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setLoadFailed(true))
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

  const clearFieldError = (key: string) =>
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));

  const openRecord = () => {
    setForm({ ...blankForm }); setEditingId(null); setError(""); setFieldErrors({}); setView("record");
  };
  const openEdit = (s: Session) => {
    setForm({
      classDate: s.classDate, startTime: s.startTime, endTime: s.endTime,
      deliveredHours: String(s.deliveredHours), attendanceStatus: s.attendanceStatus,
      classStatus: s.classStatus, isChargeable: s.isChargeable,
      lessonTopic: s.lessonTopic, notes: s.notes, homework: s.homework,
    });
    setEditingId(s.id); setError(""); setFieldErrors({}); setView("record");
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.classDate) errs.classDate = "Pick the class date.";
    if (!form.deliveredHours || Number(form.deliveredHours) <= 0)
      errs.deliveredHours = "Enter the hours delivered (more than 0).";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

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
    } catch (err) { setError((err as Error).message || "Couldn't save the class. Try again."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true); setHistoryError("");
    try {
      const res = await fetch(`/api/class-sessions/${pendingDelete.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      refreshHours(d.hours);
      load();
    } catch (err) {
      setHistoryError((err as Error).message || "Couldn't delete the class. Try again.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const submitAdjust = async () => {
    const errs: Record<string, string> = {};
    if (!adjForm.hours || Number(adjForm.hours) <= 0)
      errs.hours = "Enter the hours to adjust (more than 0).";
    if (!adjForm.reason.trim())
      errs.reason = "A reason is required for the audit trail.";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

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
    } catch (err) { setError((err as Error).message || "Couldn't record the adjustment. Try again."); }
    finally { setSaving(false); }
  };

  const completedCount = sessions.filter((s) => s.classStatus === "Completed").length;
  const attended = sessions.filter((s) => s.classStatus === "Completed" && ["Present", "Late"].includes(s.attendanceStatus)).length;
  const attendancePct = completedCount > 0 ? Math.round((attended / completedCount) * 100) : 0;

  const { slice, page, pages, setPage, total } = usePagination(sessions, 25);

  return (
    <>
      <Drawer
        open
        onClose={() => { if (!pendingDelete) onClose(); }}
        title={reg.fullName}
        size="xl"
      >
        <div className="space-y-4">
          <p className="-mt-1 text-xs text-dim">
            {reg.course}{reg.teacherName ? ` · Teacher: ${reg.teacherName}` : ""}
          </p>

          {okMsg && (
            <p role="status" className="rounded-ctl border border-phos/30 bg-phos/10 px-3 py-2 text-sm font-semibold text-phos">
              {okMsg}
            </p>
          )}
          {historyError && (
            <p role="alert" className="rounded-ctl border border-alert/30 bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
              {historyError}
            </p>
          )}

          {/* Summary instruments */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Registered", `${reg.totalRegisteredHours || 0}h`],
              ["Completed", `${reg.completedHours}h`],
              ["Remaining", `${reg.remainingHours}h`],
              ["Attendance", `${attendancePct}%`],
            ].map(([l, v]) => (
              <div key={l as string} className="face p-3 text-center">
                <p className="readout text-lg font-bold text-ink" data-numeric>{v}</p>
                <p className="placard mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          <HoursProgress total={reg.totalRegisteredHours} completed={reg.completedHours} />

          {/* Actions */}
          {view === "history" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" size="sm" onClick={openRecord}>
                <Plus className="h-4 w-4" aria-hidden /> Record Class
              </Button>
              {canManage && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setError(""); setFieldErrors({}); setView("adjust"); }}
                >
                  Adjust Hours
                </Button>
              )}
            </div>
          )}

          {/* Record / edit class form */}
          {view === "record" && (
            <div className="space-y-3 rounded-card border border-phos/30 bg-well p-4">
              <p className="text-sm font-bold text-ink">{editingId ? "Edit Class Record" : "Record a Class"}</p>
              {error && (
                <p role="alert" className="rounded-ctl border border-alert/30 bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Class Date" required error={fieldErrors.classDate}>
                  <DatePicker
                    value={form.classDate}
                    onChange={(v) => { setForm((f) => ({ ...f, classDate: v })); clearFieldError("classDate"); }}
                    required
                  />
                </Field>
                <Field label="Delivered Hours" required error={fieldErrors.deliveredHours}>
                  <Input
                    type="number" step="0.25" min="0.25" value={form.deliveredHours}
                    onChange={(e) => { setForm((f) => ({ ...f, deliveredHours: e.target.value })); clearFieldError("deliveredHours"); }}
                    placeholder="e.g. 2"
                  />
                </Field>
                <Field label="Start Time">
                  <Input
                    type="time" value={form.startTime}
                    onChange={(e) => { setForm((f) => ({ ...f, startTime: e.target.value })); autoHours(e.target.value, form.endTime); }}
                  />
                </Field>
                <Field label="End Time">
                  <Input
                    type="time" value={form.endTime}
                    onChange={(e) => { setForm((f) => ({ ...f, endTime: e.target.value })); autoHours(form.startTime, e.target.value); }}
                  />
                </Field>
                <Field label="Attendance">
                  <Select value={form.attendanceStatus} onChange={(e) => setForm((f) => ({ ...f, attendanceStatus: e.target.value }))}>
                    {attendanceOptions.map((o) => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
                <Field label="Class Status">
                  <Select value={form.classStatus} onChange={(e) => setForm((f) => ({ ...f, classStatus: e.target.value }))}>
                    {classStatusOptions.map((o) => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Lesson Topic">
                <Input value={form.lessonTopic} onChange={(e) => setForm((f) => ({ ...f, lessonTopic: e.target.value }))} />
              </Field>
              <Field label="Class Notes">
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>
              <Field label="Homework / Next Steps">
                <Input value={form.homework} onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))} />
              </Field>
              {canManage && ["Absent", "No Show"].includes(form.classStatus === "No Show" ? "No Show" : form.attendanceStatus) && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isChargeable}
                    onChange={(e) => setForm((f) => ({ ...f, isChargeable: e.target.checked }))}
                    className="h-4 w-4 accent-phos"
                  />
                  <span className="text-dim">Chargeable (deduct hours even though the student was absent / no-show)</span>
                </label>
              )}
              <div className="flex gap-2">
                <Button variant="solid" onClick={submit} disabled={saving} className="flex-1">
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Save Class"}
                </Button>
                <Button variant="secondary" onClick={() => setView("history")} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Hour adjustment (admin/manager) */}
          {view === "adjust" && canManage && (
            <div className="space-y-3 rounded-card border border-caution/40 bg-well p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-ink">Hour Adjustment</p>
                <Lamp variant="caution">Audited</Lamp>
              </div>
              {error && (
                <p role="alert" className="rounded-ctl border border-alert/30 bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select value={adjForm.adjustmentType} onChange={(e) => setAdjForm((f) => ({ ...f, adjustmentType: e.target.value }))}>
                    <option>Add Hours</option><option>Deduct Hours</option><option>Correction</option>
                  </Select>
                </Field>
                <Field label="Hours" required error={fieldErrors.hours}>
                  <Input
                    type="number" step="0.25" min="0.25" value={adjForm.hours}
                    onChange={(e) => { setAdjForm((f) => ({ ...f, hours: e.target.value })); clearFieldError("hours"); }}
                  />
                </Field>
              </div>
              <Field label="Reason" required error={fieldErrors.reason} help="Recorded in the audit trail.">
                <Input
                  value={adjForm.reason}
                  onChange={(e) => { setAdjForm((f) => ({ ...f, reason: e.target.value })); clearFieldError("reason"); }}
                  placeholder="Why is this adjustment needed?"
                />
              </Field>
              <div className="flex gap-2">
                <Button variant="primary" onClick={submitAdjust} disabled={saving} className="flex-1">
                  {saving ? "Saving…" : "Apply Adjustment"}
                </Button>
                <Button variant="secondary" onClick={() => setView("history")} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* History list */}
          <div>
            <p className="placard mb-2">
              Class History (<span data-numeric>{sessions.length}</span>)
            </p>
            {loading ? (
              <div className="space-y-2" aria-label="Loading class history">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-card" />
                ))}
              </div>
            ) : loadFailed ? (
              <LoadError message="Couldn't load the class history." onRetry={load} />
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No classes recorded yet"
                description="Record the first class to start tracking delivered hours."
                action={
                  <Button variant="primary" size="sm" onClick={openRecord}>
                    <Plus className="h-4 w-4" aria-hidden /> Record Class
                  </Button>
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {slice.map((s) => (
                    <div key={s.id} className="face p-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="readout text-sm font-semibold text-ink" data-numeric>{s.classDate}</span>
                        {(s.startTime || s.endTime) && (
                          <span className="readout text-xs text-faint" data-numeric>{s.startTime}–{s.endTime}</span>
                        )}
                        <span className="readout text-sm font-bold text-ink" data-numeric>{s.deliveredHours}h</span>
                        <Lamp variant={ATT_LAMP[s.attendanceStatus] ?? "off"}>{s.attendanceStatus}</Lamp>
                        <Lamp variant={CLASS_LAMP[s.classStatus] ?? "off"}>{s.classStatus}</Lamp>
                        {s.isChargeable && <Lamp variant="caution">Chargeable</Lamp>}
                        <span className="flex-1" />
                        {canManage && (
                          <span className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => openEdit(s)}
                              aria-label={`Edit the class on ${s.classDate}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => { setHistoryError(""); setPendingDelete(s); }}
                              aria-label={`Delete the class on ${s.classDate}`}
                              className="hover:text-alert"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        )}
                      </div>
                      {s.lessonTopic && (
                        <p className="mt-1 text-xs text-dim">
                          <span className="font-bold text-ink">Topic:</span> {s.lessonTopic}
                        </p>
                      )}
                      {s.notes && <p className="mt-0.5 text-xs text-dim">{s.notes}</p>}
                      {s.homework && (
                        <p className="mt-0.5 text-xs text-advisory">
                          <span className="font-bold">Homework:</span> {s.homework}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-faint">
                        Teacher: {s.teacherName} · Recorded by {s.recordedBy}
                      </p>
                    </div>
                  ))}
                </div>
                {pages > 1 && (
                  <div className="mt-3 text-xs text-dim">
                    <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
        title="Delete Class Record"
        message={
          pendingDelete
            ? `This removes the ${pendingDelete.deliveredHours}h class on ${pendingDelete.classDate}. Hours will be recalculated.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        busy={deleting}
      />
    </>
  );
}
