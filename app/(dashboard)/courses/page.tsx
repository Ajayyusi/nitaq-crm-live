"use client";

import { Fragment, FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Edit3, Plus, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { courseCategories, courseStatuses } from "@/constants/modelConstants";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Input, Textarea, Select, Field, SearchInput } from "@/components/ui/input";
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
import { formatAED } from "@/lib/utils";

type Batch = {
  id: string; batchId: string; batchName: string; startDate: string; endDate: string;
  schedule: string; format: string; trainerName: string; maxStudents: number | null; status: string;
};

type Course = {
  id: string; courseCode: string; courseName: string; category: string; description: string;
  durationWeeks: number | null; totalSessions: number | null; sessionsPerWeek: number | null;
  hoursPerSession: number | null; totalHours: number | null; priceExVat: number; vatRate: number;
  priceInclVat: number; maxStudentsPerBatch: number | null; status: string; speaActivity: string;
  deliveryMethod: string; assignedTeacherIds: string[]; assignedTeacherNames: string[];
  registeredStudents: number;
  batches: Batch[];
};

type FormState = {
  courseName: string; courseCode: string; category: string; description: string;
  durationWeeks: string; totalSessions: string; sessionsPerWeek: string; hoursPerSession: string;
  priceExVat: string; vatRate: string; maxStudentsPerBatch: string; status: string; speaActivity: string;
  totalHours: string; deliveryMethod: string; assignedTeacherIds: string[];
};

const emptyForm: FormState = {
  courseName: "", courseCode: "", category: "Computer Software Training",
  description: "", durationWeeks: "", totalSessions: "", sessionsPerWeek: "",
  hoursPerSession: "", priceExVat: "", vatRate: "5", maxStudentsPerBatch: "", status: "Active", speaActivity: "",
  totalHours: "", deliveryMethod: "", assignedTeacherIds: [],
};

function getErr(v: unknown, fb: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string") return v.message;
  return fb;
}

/** Batch lifecycle states missing from the shared StatusBadge map. */
const BATCH_LAMP: Record<string, LampVariant> = {
  Open: "ok",
  "In Progress": "advisory",
  Completed: "off",
  Cancelled: "alert",
};

function CourseStatusLamp({ status }: { status: string }) {
  if (status === "Coming Soon") return <Lamp variant="advisory">Coming Soon</Lamp>;
  return <StatusBadge status={status} />;
}

/** Debounce a value so typing doesn't refetch on every keystroke. */
function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CoursesPage() {
  const { data: session } = useSession();
  const rawRole = (session?.user as { role?: string })?.role ?? "sales";
  const role = rawRole === "staff" ? "sales" : rawRole;
  const isReadOnly = role === "sales" || role === "trainer";

  const [courses, setCourses] = useState<Course[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; fullName: string }[]>([]);
  const [teachersFailed, setTeachersFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTeachers = useCallback(async () => {
    setTeachersFailed(false);
    try {
      const r = await fetch("/api/teachers");
      const d = await r.json();
      setTeacherOptions(
        (d.trainers ?? []).map((t: { id: string; fullName: string }) => ({ id: t.id, fullName: t.fullName }))
      );
    } catch {
      setTeachersFailed(true);
    }
  }, []);
  useEffect(() => { void loadTeachers(); }, [loadTeachers]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/courses?${params}`, { cache: "no-store" });
      const data = await res.json();
      setCourses(data.courses ?? []);
    } catch {
      setLoadError("Couldn't load courses. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditingCourse(null); setForm(emptyForm); setFormError(""); setFieldErrors({}); setDrawerOpen(true);
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
      totalHours: c.totalHours != null ? String(c.totalHours) : "",
      deliveryMethod: c.deliveryMethod ?? "", assignedTeacherIds: c.assignedTeacherIds ?? [],
    });
    setFormError(""); setFieldErrors({}); setDrawerOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.courseName.trim()) errs.courseName = "Course name is required.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true); setFormError("");
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
    } catch (caught) { setFormError(getErr(caught, "Couldn't save the course. Check the fields and retry.")); }
    finally { setSaving(false); }
  }

  async function deleteCourse(c: Course) {
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/courses/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotice("Course deleted.");
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
      setActionError("Couldn't delete the course. Retry, or contact your administrator.");
    } finally {
      setDeleting(false);
    }
  }

  const { slice, page, pages, setPage, total } = usePagination(courses);
  const colCount = isReadOnly ? 7 : 8;

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Course catalog, pricing, and batch scheduling"
        actions={
          !isReadOnly && (
            <Button variant="solid" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden /> Add Course
            </Button>
          )
        }
      />

      {(notice || actionError) && (
        <div className="mb-4 space-y-2">
          {notice && (
            <div role="status" className="flex items-center justify-between gap-2 rounded-ctl border border-phos/30 bg-[var(--lamp-ok-bg)] px-4 py-2 text-sm font-semibold text-phos">
              <span>{notice}</span>
              <Button variant="ghost" size="iconSm" onClick={() => setNotice("")} aria-label="Dismiss message">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {actionError && (
            <div role="alert" className="flex items-center justify-between gap-2 rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-2 text-sm font-semibold text-alert">
              <span>{actionError}</span>
              <Button variant="ghost" size="iconSm" onClick={() => setActionError("")} aria-label="Dismiss error">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-full sm:w-72"
          placeholder="Search courses"
          aria-label="Search courses"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          {courseStatuses.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={6} cols={6} />
          ) : courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses found"
              description={
                debouncedSearch.trim() || statusFilter !== "all"
                  ? "No courses match the current filters. Clear them to see the full catalog."
                  : "Add the first course to start building the catalog."
              }
              action={
                !isReadOnly && (
                  <Button variant="primary" onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden /> Add Course
                  </Button>
                )
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th className="w-10"><span className="sr-only">Expand</span></Th>
                    <Th>Course</Th>
                    <Th>Category</Th>
                    <Th numeric>Price</Th>
                    <Th numeric>Students</Th>
                    <Th numeric>Batches</Th>
                    <Th>Status</Th>
                    {!isReadOnly && <Th className="text-right"><span className="sr-only">Actions</span></Th>}
                  </tr>
                </THead>
                <tbody>
                  {slice.map((c) => {
                    const expanded = expandedId === c.id;
                    return (
                      <Fragment key={c.id}>
                        <Tr clickable onClick={() => setExpandedId(expanded ? null : c.id)}>
                          <Td className="w-10 pr-0">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              aria-expanded={expanded}
                              aria-label={expanded ? `Collapse batches for ${c.courseName}` : `Expand batches for ${c.courseName}`}
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : c.id); }}
                            >
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </Td>
                          <Td>
                            <p className="font-semibold">{c.courseName}</p>
                            <p className="mt-0.5 text-xs text-faint">
                              <span className="readout">{c.courseCode}</span>
                              {c.deliveryMethod && <> · {c.deliveryMethod}</>}
                              {c.totalHours ? <> · {c.totalHours}h default</> : null}
                            </p>
                            {c.assignedTeacherNames?.length > 0 && (
                              <p className="mt-0.5 max-w-xs truncate text-xs text-faint" title={c.assignedTeacherNames.join(", ")}>
                                Trainers: {c.assignedTeacherNames.join(", ")}
                              </p>
                            )}
                          </Td>
                          <Td className="text-dim">{c.category}</Td>
                          <Td numeric>
                            {formatAED(c.priceExVat)}
                            <span className="block text-[11px] text-faint">incl. VAT {formatAED(c.priceInclVat)}</span>
                          </Td>
                          <Td numeric>{c.registeredStudents}</Td>
                          <Td numeric>{c.batches.length}</Td>
                          <Td><CourseStatusLamp status={c.status} /></Td>
                          {!isReadOnly && (
                            <Td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="iconSm"
                                  aria-label={`Edit ${c.courseName}`}
                                  onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="iconSm"
                                  className="text-alert hover:text-alert"
                                  aria-label={`Delete ${c.courseName}`}
                                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </Td>
                          )}
                        </Tr>
                        {expanded && (
                          <Tr>
                            <Td colSpan={colCount} className="bg-well/60 px-4 py-3">
                              {c.batches.length === 0 ? (
                                <p className="text-xs text-dim">No batches yet. Add them from the course edit form.</p>
                              ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {c.batches.map((b) => (
                                    <div key={b.id} className="rounded-ctl border border-bezel bg-face p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold text-ink" title={b.batchName}>{b.batchName}</p>
                                        <Lamp variant={BATCH_LAMP[b.status] ?? "off"}>{b.status}</Lamp>
                                      </div>
                                      <div className="mt-1.5 space-y-0.5 text-xs text-dim">
                                        {b.trainerName && <p>Trainer: {b.trainerName}</p>}
                                        {b.schedule && <p>{b.schedule}</p>}
                                        {b.startDate && (
                                          <p className="readout" data-numeric>{b.startDate} → {b.endDate}</p>
                                        )}
                                        <p>{b.format}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
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
        title={editingCourse ? "Edit Course" : "Add Course"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" type="submit" form="course-form" disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {editingCourse ? "Save Changes" : "Create Course"}
            </Button>
          </>
        }
      >
        <form id="course-form" onSubmit={save} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert">
              {formError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course Name" required error={fieldErrors.courseName} htmlFor="course-name" className="sm:col-span-2">
              <Input
                id="course-name"
                value={form.courseName}
                aria-invalid={fieldErrors.courseName ? true : undefined}
                onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))}
                placeholder="e.g. AI for Professionals"
              />
            </Field>
            <Field label="Course Code" htmlFor="course-code" help="Auto-generated if blank">
              <Input id="course-code" value={form.courseCode} onChange={(e) => setForm((f) => ({ ...f, courseCode: e.target.value }))} />
            </Field>
            <Field label="Category" required htmlFor="course-category">
              <Select id="course-category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {courseCategories.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Price (AED excl. VAT)" htmlFor="course-price">
              <Input id="course-price" type="number" min="0" value={form.priceExVat} onChange={(e) => setForm((f) => ({ ...f, priceExVat: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="VAT Rate (%)" htmlFor="course-vat">
              <Input id="course-vat" type="number" min="0" max="100" value={form.vatRate} onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))} />
            </Field>
            <Field label="Duration (Weeks)" htmlFor="course-weeks">
              <Input id="course-weeks" type="number" min="1" value={form.durationWeeks} onChange={(e) => setForm((f) => ({ ...f, durationWeeks: e.target.value }))} />
            </Field>
            <Field label="Total Sessions" htmlFor="course-sessions">
              <Input id="course-sessions" type="number" min="1" value={form.totalSessions} onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))} />
            </Field>
            <Field label="Sessions / Week" htmlFor="course-spw">
              <Input id="course-spw" type="number" min="1" value={form.sessionsPerWeek} onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: e.target.value }))} />
            </Field>
            <Field label="Hours / Session" htmlFor="course-hps">
              <Input id="course-hps" type="number" min="0.5" step="0.5" value={form.hoursPerSession} onChange={(e) => setForm((f) => ({ ...f, hoursPerSession: e.target.value }))} />
            </Field>
            <Field label="Max Students / Batch" htmlFor="course-max">
              <Input id="course-max" type="number" min="1" value={form.maxStudentsPerBatch} onChange={(e) => setForm((f) => ({ ...f, maxStudentsPerBatch: e.target.value }))} />
            </Field>
            <Field label="Status" htmlFor="course-status">
              <Select id="course-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {courseStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="SPEA Activity" htmlFor="course-spea" className="sm:col-span-2">
              <Input id="course-spea" value={form.speaActivity} onChange={(e) => setForm((f) => ({ ...f, speaActivity: e.target.value }))} placeholder="Licensed activity name" />
            </Field>
            <Field label="Default Training Hours" htmlFor="course-hours">
              <Input id="course-hours" type="number" min="0" value={form.totalHours} onChange={(e) => setForm((f) => ({ ...f, totalHours: e.target.value }))} placeholder="e.g. 40" />
            </Field>
            <Field label="Delivery Method" htmlFor="course-delivery">
              <Select id="course-delivery" value={form.deliveryMethod} onChange={(e) => setForm((f) => ({ ...f, deliveryMethod: e.target.value }))}>
                <option value="">Not set</option>
                <option>In-Person</option><option>Online</option><option>Hybrid</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold text-dim">Assigned Trainers</span>
              <div className="flex flex-wrap gap-2 rounded-ctl border border-bezel-strong bg-well p-3">
                {teachersFailed ? (
                  <span className="flex items-center gap-2 text-xs text-alert">
                    Couldn't load trainers.
                    <Button variant="ghost" size="sm" type="button" onClick={() => void loadTeachers()}>Retry</Button>
                  </span>
                ) : teacherOptions.length === 0 ? (
                  <span className="text-xs text-faint">No trainers found.</span>
                ) : (
                  teacherOptions.map((t) => {
                    const on = form.assignedTeacherIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            assignedTeacherIds: on
                              ? f.assignedTeacherIds.filter((x) => x !== t.id)
                              : [...f.assignedTeacherIds, t.id],
                          }))
                        }
                        className={
                          on
                            ? "rounded-ctl border border-transparent bg-phos px-3 py-1 text-xs font-semibold text-phos-ink"
                            : "rounded-ctl border border-bezel-strong bg-face px-3 py-1 text-xs font-semibold text-dim transition-colors hover:text-ink"
                        }
                      >
                        {t.fullName}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <Field label="Description" htmlFor="course-desc" className="sm:col-span-2">
              <Textarea id="course-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => { if (!deleting) setConfirmDelete(null); }}
        onConfirm={() => { if (confirmDelete) void deleteCourse(confirmDelete); }}
        title="Delete Course"
        message={confirmDelete ? `Delete "${confirmDelete.courseName}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleting}
      />
    </div>
  );
}
