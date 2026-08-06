"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Edit3, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { courseList } from "@/constants/leads";
import { attendanceStatuses } from "@/constants/modelConstants";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Input, Select, Field } from "@/components/ui/input";
import { Drawer, ConfirmDialog } from "@/components/ui/dialog";
import {
  TableShell,
  Table,
  THead,
  Th,
  Tr,
  Td,
  TableFooter,
  usePagination,
  Pagination,
} from "@/components/ui/table";
import { SkeletonRows, LoadError, Spinner } from "@/components/ui/feedback";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";
import { TickGauge } from "@/components/ui/tick-gauge";

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

const BLANK_SESSION = {
  course: "", batchName: "", sessionDate: today,
  sessionNumber: "", topic: "", trainerName: "",
};

function attendanceLamp(status: string): LampVariant {
  switch (status) {
    case "Present": return "ok";
    case "Late": return "caution";
    case "Absent": return "alert";
    default: return "off"; // Excused
  }
}

function rateLamp(pct: number): LampVariant {
  return pct >= 80 ? "ok" : pct >= 60 ? "caution" : "alert";
}

export default function ClassesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsFailed, setEnrollmentsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [form, setForm] = useState({ ...BLANK_SESSION });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (courseFilter !== "All") params.set("course", courseFilter);
      const res = await fetch(`/api/attendance?${params}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      setLoadError("Couldn't load sessions. Check your connection and retry.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [courseFilter]);

  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsFailed(false);
    try {
      const res = await fetch("/api/enrollments?status=Active");
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setEnrollments([]);
      setEnrollmentsFailed(true);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  function openNew() {
    setEditTarget(null);
    setForm({ ...BLANK_SESSION });
    setRecords([]);
    setError("");
    setFieldErrors({});
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
    setFieldErrors({});
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
    const errs: Record<string, string> = {};
    if (!form.course) errs.course = "Select a course.";
    if (!form.sessionDate) errs.sessionDate = "Choose the session date.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
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
      setError(e instanceof Error ? e.message : "Couldn't save the session. Check the fields and retry.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(s: Session) {
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/attendance/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmDelete(null);
      void fetchSessions();
    } catch {
      setConfirmDelete(null);
      setActionError("Couldn't delete the session. Retry, or contact your administrator.");
    } finally {
      setDeleting(false);
    }
  }

  const totals = {
    sessions: sessions.length,
    students: sessions.reduce((sum, s) => sum + s.totalCount, 0),
    present: sessions.reduce((sum, s) => sum + s.presentCount, 0),
  };
  const avgAtt = totals.students > 0 ? Math.round((totals.present / totals.students) * 100) : 0;
  const absences = totals.students - totals.present;

  const { slice, page, pages, setPage, total } = usePagination(sessions);
  const presentInDraft = records.filter((r) => r.status === "Present").length;
  const absentInDraft = records.filter((r) => r.status === "Absent").length;
  const lateInDraft = records.filter((r) => r.status === "Late").length;

  return (
    <div>
      <PageHeader
        title="Classes & Attendance"
        subtitle="Record sessions and track student attendance"
        actions={
          <Button variant="solid" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden /> Record Session
          </Button>
        }
      />

      <InstrumentRow className="mb-4 md:grid-cols-4 xl:grid-cols-4">
        <Instrument label="Sessions" value={totals.sessions} sub="Recorded sessions" />
        <Instrument label="Attendance Records" value={totals.students} sub="Student check-ins" />
        <Instrument
          label="Present Rate"
          value={`${avgAtt}%`}
          tone={avgAtt >= 80 ? "phos" : avgAtt >= 60 ? "caution" : totals.students > 0 ? "alert" : "ink"}
        >
          <TickGauge percent={avgAtt} cautionBelow={79} alertBelow={59} className="mt-2" />
        </Instrument>
        <Instrument label="Absences" value={absences} tone={absences > 0 ? "alert" : "ink"} sub="Marked absent" />
      </InstrumentRow>

      {actionError && (
        <div role="alert" className="mb-4 rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-2 text-sm font-semibold text-alert">
          {actionError}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="w-full sm:w-72"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          aria-label="Filter sessions by course"
        >
          {["All", ...courseList].map((c) => (
            <option key={c} value={c}>{c === "All" ? "All Courses" : c}</option>
          ))}
        </Select>
      </div>

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void fetchSessions()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={6} cols={6} />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No sessions recorded"
              description={
                courseFilter !== "All"
                  ? "No sessions match this course filter."
                  : "Record the first class session and mark attendance."
              }
              action={
                <Button variant="primary" onClick={openNew}>
                  <Plus className="h-4 w-4" aria-hidden /> Record Session
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th className="w-10"><span className="sr-only">Expand</span></Th>
                    <Th>Session</Th>
                    <Th>Batch</Th>
                    <Th>Date</Th>
                    <Th>Trainer</Th>
                    <Th numeric>Attendance</Th>
                    <Th className="text-right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((s) => {
                    const expanded = expandedId === s.id;
                    const sessionLabel = s.sessionNumber ? `Session ${s.sessionNumber}` : `session on ${s.sessionDate}`;
                    return (
                      <Fragment key={s.id}>
                        <Tr clickable onClick={() => setExpandedId(expanded ? null : s.id)}>
                          <Td className="w-10 pr-0">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              aria-expanded={expanded}
                              aria-label={expanded ? `Collapse attendance for ${sessionLabel}` : `Expand attendance for ${sessionLabel}`}
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : s.id); }}
                            >
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </Td>
                          <Td>
                            <p className="font-semibold">
                              {s.sessionNumber ? `Session ${s.sessionNumber} — ` : ""}{s.course}
                            </p>
                            {s.topic && (
                              <p className="mt-0.5 max-w-xs truncate text-xs text-faint" title={s.topic}>{s.topic}</p>
                            )}
                          </Td>
                          <Td className="text-dim">{s.batchName || "—"}</Td>
                          <Td><span className="readout text-xs" data-numeric>{s.sessionDate}</span></Td>
                          <Td className="text-dim">{s.trainerName || "—"}</Td>
                          <Td numeric>
                            <span className="mr-2">{s.presentCount}/{s.totalCount}</span>
                            <Lamp variant={rateLamp(s.attendancePct)}>{s.attendancePct}%</Lamp>
                          </Td>
                          <Td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="iconSm"
                                aria-label={`Edit ${sessionLabel}`}
                                onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                className="text-alert hover:text-alert"
                                aria-label={`Delete ${sessionLabel}`}
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                        {expanded && s.records.length > 0 && (
                          <Tr>
                            <Td colSpan={7} className="bg-well/60 px-4 py-3">
                              <table className="w-full min-w-[320px] text-xs">
                                <thead>
                                  <tr>
                                    <th className="placard py-1 pr-4 text-left">Student</th>
                                    <th className="placard py-1 pr-4 text-left">Status</th>
                                    <th className="placard py-1 text-left">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.records.map((r, i) => (
                                    <tr key={i} className="border-t border-bezel/60">
                                      <td className="py-1.5 pr-4 font-medium text-ink">{r.studentName}</td>
                                      <td className="py-1.5 pr-4">
                                        <Lamp variant={attendanceLamp(r.status)}>{r.status}</Lamp>
                                      </td>
                                      <td className="py-1.5 text-dim">{r.notes || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </Td>
                          </Tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
              <TableFooter>
                <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
              </TableFooter>
            </>
          )}
        </TableShell>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? "Edit Session" : "Record Session"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" onClick={() => void save()} disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {editTarget ? "Update Session" : "Save Attendance"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Course" required error={fieldErrors.course} htmlFor="session-course" className="col-span-2">
              <Select
                id="session-course"
                value={form.course}
                aria-invalid={fieldErrors.course ? true : undefined}
                onChange={(e) => {
                  setForm((f) => ({ ...f, course: e.target.value }));
                  if (!editTarget) loadEnrolleesForCourse(e.target.value);
                }}
              >
                <option value="">Select course</option>
                {courseList.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Batch Name" htmlFor="session-batch">
              <Input
                id="session-batch"
                value={form.batchName}
                onChange={(e) => setForm((f) => ({ ...f, batchName: e.target.value }))}
                placeholder="e.g. Batch A"
              />
            </Field>
            <Field label="Session No." htmlFor="session-number">
              <Input
                id="session-number"
                type="number"
                min="1"
                value={form.sessionNumber}
                onChange={(e) => setForm((f) => ({ ...f, sessionNumber: e.target.value }))}
                placeholder="1"
              />
            </Field>
            <Field label="Session Date" required error={fieldErrors.sessionDate}>
              <DatePicker
                value={form.sessionDate}
                onChange={(v) => setForm((f) => ({ ...f, sessionDate: v }))}
                required
              />
            </Field>
            <Field label="Trainer" htmlFor="session-trainer">
              <Input
                id="session-trainer"
                value={form.trainerName}
                onChange={(e) => setForm((f) => ({ ...f, trainerName: e.target.value }))}
                placeholder="Trainer name"
              />
            </Field>
            <Field label="Topic / Agenda" htmlFor="session-topic" className="col-span-2">
              <Input
                id="session-topic"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="What was covered?"
              />
            </Field>
          </div>

          {enrollmentsFailed && !editTarget && (
            <div role="alert" className="flex items-center justify-between gap-2 rounded-ctl border border-caution/30 bg-[var(--lamp-caution-bg)] px-3 py-2 text-xs font-semibold text-caution">
              <span>Couldn't load active enrollments — the student list may be incomplete.</span>
              <Button variant="ghost" size="sm" onClick={() => void fetchEnrollments()}>Retry</Button>
            </div>
          )}

          {records.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  Attendance <span className="readout text-dim" data-numeric>({records.length} students)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {attendanceStatuses.map((s) => (
                    <Button key={s} type="button" variant="secondary" size="sm" onClick={() => markAll(s)}>
                      All {s}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-ctl border border-bezel">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-well">
                      <tr>
                        <th className="placard border-b border-bezel px-3 py-2 text-left">Student</th>
                        <th className="placard border-b border-bezel px-3 py-2 text-left">Status</th>
                        <th className="placard border-b border-bezel px-3 py-2 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr
                          key={i}
                          className={`border-b border-bezel/60 last:border-0 ${
                            r.status === "Absent"
                              ? "bg-[var(--lamp-alert-bg)]"
                              : r.status === "Late"
                                ? "bg-[var(--lamp-caution-bg)]"
                                : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-medium text-ink">{r.studentName}</td>
                          <td className="px-3 py-2">
                            <Select
                              className="h-8 w-28 pr-6 text-xs"
                              value={r.status}
                              aria-label={`Attendance status for ${r.studentName}`}
                              onChange={(e) => updateRecord(i, "status", e.target.value)}
                            >
                              {attendanceStatuses.map((s) => <option key={s}>{s}</option>)}
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 border-0 bg-transparent px-1 text-xs"
                              placeholder="Optional note"
                              aria-label={`Note for ${r.studentName}`}
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
              <p className="readout mt-1.5 text-xs text-dim" data-numeric>
                {presentInDraft} present · {absentInDraft} absent · {lateInDraft} late
              </p>
            </div>
          )}

          {records.length === 0 && form.course && (
            <div className="rounded-ctl border border-dashed border-bezel-strong bg-well/50 p-4 text-center">
              <p className="text-xs text-dim">
                No active enrollments found for this course. Students will appear automatically once enrolled.
              </p>
            </div>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => { if (!deleting) setConfirmDelete(null); }}
        onConfirm={() => { if (confirmDelete) void deleteSession(confirmDelete); }}
        title="Delete Session"
        message={
          confirmDelete
            ? `Delete ${confirmDelete.sessionNumber ? `Session ${confirmDelete.sessionNumber}` : `session on ${confirmDelete.sessionDate}`}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        busy={deleting}
      />
    </div>
  );
}
