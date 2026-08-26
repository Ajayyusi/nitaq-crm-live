"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ClipboardList, Edit3, MessageCircle, Plus, Trash2, X, XCircle,
} from "lucide-react";
import { enrollmentStatuses, paymentMethods, paymentStatuses, scheduleFormats, teacherPayBases } from "@/constants/modelConstants";
import { courseList } from "@/constants/leads";
import DateRangePicker from "@/components/shared/DateRangePicker";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { thisMonthRange } from "@/lib/dateRange";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Drawer } from "@/components/ui/dialog";
import {
  Pagination, Table, TableFooter, TableShell, Td, Th, THead, Tr, usePagination,
} from "@/components/ui/table";
import { Instrument } from "@/components/ui/instrument";
import { LoadError, SkeletonRows, Spinner } from "@/components/ui/feedback";

type Enrollment = {
  id: string; enrollmentId: string; fullName: string; phone: string; email: string;
  course: string; batchName: string; startDate: string; endDate: string; schedule: string;
  format: string; status: string; paymentStatus: string; totalFee: number; amountPaid: number;
  balanceDue: number; notes: string; registrationDate: string;
  teacherId: string; teacherName: string; teacherIds: string[]; teacherNames: string[];
  teacherPayRate: number | null; teacherPayBasis: string;
  totalRegisteredHours: number; completedHours: number; remainingHours: number;
  expectedCompletionDate: string;
  registrationComplete: boolean; missingFields: string[];
};

type FormState = {
  fullName: string; phone: string; email: string; emiratesId: string; nationality: string;
  course: string; batchName: string; startDate: string; endDate: string; schedule: string;
  format: string; status: string; paymentStatus: string; totalFee: string; amountPaid: string;
  paymentMethod: string; notes: string;
  teacherIds: string[]; totalRegisteredHours: string; expectedCompletionDate: string;
  teacherPayRate: string; teacherPayBasis: string;
};

type TeacherOption = { id: string; fullName: string; paymentRate: number | null; paymentType: string };

const emptyForm: FormState = {
  fullName: "", phone: "", email: "", emiratesId: "", nationality: "",
  course: "Other", batchName: "", startDate: "", endDate: "", schedule: "",
  format: "In-Person", status: "Active", paymentStatus: "Instalment 1 Paid",
  totalFee: "", amountPaid: "", paymentMethod: "Cash", notes: "",
  teacherIds: [], totalRegisteredHours: "", expectedCompletionDate: "",
  teacherPayRate: "", teacherPayBasis: "Per Hour",
};

function getErr(v: unknown, fb: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string") return v.message;
  return fb;
}

function fmtCurrency(n: number) {
  return `AED ${n.toLocaleString()}`;
}

const PAY_LAMP: Record<string, LampVariant> = {
  "Paid Full": "ok",
  "Instalment 1 Paid": "advisory",
  "Instalment 2 Pending": "caution",
  Overdue: "alert",
  Free: "advisory",
};

function RegistrationChecklist({ form }: { form: FormState }) {
  const checks: [string, boolean][] = [
    ["Student Information", !!form.fullName && !!form.phone],
    ["Course Selected", !!form.course],
    ["Trainer Assigned", form.teacherIds.length > 0],
    ["Total Registered Hours", !!form.totalRegisteredHours],
    ["Start Date", !!form.startDate],
    ["Expected Completion Date", !!form.expectedCompletionDate],
    ["Payment Information", !!form.paymentStatus],
  ];
  const missing = checks.filter(([, ok]) => !ok).length;
  return (
    <div
      className={`rounded-card border px-4 py-3 ${
        missing ? "border-alert/30 bg-[var(--lamp-alert-bg)]" : "border-phos/30 bg-[var(--lamp-ok-bg)]"
      }`}
    >
      <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-bold ${missing ? "text-alert" : "text-phos"}`}>
        {missing ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Incomplete registration — {missing} item{missing > 1 ? "s" : ""} missing
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Registration complete
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {checks.map(([label, ok]) => (
          <span key={label} className={`flex items-center gap-1 text-xs font-medium ${ok ? "text-phos" : "text-alert"}`}>
            {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teachersError, setTeachersError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Enrollment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search — it drives a fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Handle lead conversion redirect: ?new=<enrollmentMongoId>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const newId = params.get("new");
    const name = params.get("name");

    if (newId) {
      // Auto-created enrollment — fetch it and open edit drawer
      fetch(`/api/enrollments/${newId}`)
        .then((r) => r.json())
        .then((d) => {
          const e = d.enrollment;
          if (!e) return;
          setEditingEnrollment(e);
          setForm({
            fullName: e.fullName, phone: e.phone, email: e.email, emiratesId: "", nationality: "",
            course: e.course, batchName: e.batchName ?? "", startDate: e.startDate ?? "",
            endDate: e.endDate ?? "", schedule: e.schedule ?? "", format: e.format ?? "In-Person",
            status: e.status, paymentStatus: e.paymentStatus,
            totalFee: String(e.totalFee), amountPaid: String(e.amountPaid),
            paymentMethod: "Cash", notes: e.notes ?? "",
            teacherIds: e.teacherIds ?? (e.teacherId ? [e.teacherId] : []), totalRegisteredHours: e.totalRegisteredHours ? String(e.totalRegisteredHours) : "",
            expectedCompletionDate: e.expectedCompletionDate ?? "",
            teacherPayRate: e.teacherPayRate != null ? String(e.teacherPayRate) : "",
            teacherPayBasis: e.teacherPayBasis || "Per Hour",
          });
          setFormError("");
          setDrawerOpen(true);
          setNotice("Enrollment auto-created from lead. Please complete the details below.");
        })
        .catch(() => {
          setError("Couldn't open the new enrollment. Find it in the list below and select Edit.");
        });
      window.history.replaceState({}, "", "/enrollments");
    } else if (name) {
      // Legacy pre-fill path
      setForm({ ...emptyForm, fullName: name, phone: params.get("phone") ?? "", email: params.get("email") ?? "", course: params.get("course") ?? "Other" });
      setEditingEnrollment(null);
      setFormError("");
      setDrawerOpen(true);
      window.history.replaceState({}, "", "/enrollments");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (payFilter !== "all") params.set("paymentStatus", payFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/enrollments?${params}`, { cache: "no-store" });
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }, [debouncedSearch, statusFilter, payFilter, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  const loadTeachers = useCallback(() => {
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((d) => {
        setTeachers(
          (d.trainers ?? []).map((t: { id: string; fullName: string; paymentRate: number | null; paymentType: string }) => ({
            id: t.id, fullName: t.fullName,
            paymentRate: t.paymentRate ?? null, paymentType: t.paymentType ?? "",
          }))
        );
        setTeachersError(false);
      })
      .catch(() => setTeachersError(true));
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  function set(field: keyof FormState, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  const teacherNameFor = (id: string) => teachers.find((t) => t.id === id)?.fullName ?? "Trainer";

  /** Add or remove a trainer. Order is preserved: the first is the primary. */
  function toggleTeacher(id: string) {
    setForm((f) => ({
      ...f,
      teacherIds: f.teacherIds.includes(id)
        ? f.teacherIds.filter((x) => x !== id)
        : [...f.teacherIds, id],
    }));
  }

  function openCreate() {
    if (teachersError) loadTeachers();
    setEditingEnrollment(null); setForm(emptyForm); setFormError(""); setDrawerOpen(true);
  }
  function openEdit(e: Enrollment) {
    if (teachersError) loadTeachers();
    setEditingEnrollment(e);
    setForm({
      fullName: e.fullName, phone: e.phone, email: e.email, emiratesId: "", nationality: "",
      course: e.course, batchName: e.batchName, startDate: e.startDate, endDate: e.endDate,
      schedule: e.schedule, format: e.format, status: e.status, paymentStatus: e.paymentStatus,
      totalFee: e.totalFee.toString(), amountPaid: e.amountPaid.toString(), paymentMethod: "Cash", notes: e.notes,
      teacherIds: e.teacherIds ?? (e.teacherId ? [e.teacherId] : []), totalRegisteredHours: e.totalRegisteredHours ? String(e.totalRegisteredHours) : "",
      expectedCompletionDate: e.expectedCompletionDate ?? "",
      teacherPayRate: e.teacherPayRate != null ? String(e.teacherPayRate) : "",
      teacherPayBasis: e.teacherPayBasis || "Per Hour",
    });
    setFormError(""); setDrawerOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError("");
    try {
      const url = editingEnrollment ? `/api/enrollments/${editingEnrollment.id}` : "/api/enrollments";
      const method = editingEnrollment ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          totalFee: Number(form.totalFee) || 0,
          amountPaid: Number(form.amountPaid) || 0,
          // A blank rate clears the override and reverts to the trainer's default;
          // the basis only means something alongside a rate.
          teacherPayRate: form.teacherPayRate === "" ? "" : Number(form.teacherPayRate) || 0,
          teacherPayBasis: form.teacherPayRate === "" ? "" : form.teacherPayBasis,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingEnrollment ? "Enrollment updated." : "Enrollment created.");
      setDrawerOpen(false);
      await load();
    } catch (caught) { setFormError(getErr(caught, "Couldn't save the enrollment. Check the fields and try again.")); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/enrollments/${toDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotice("Enrollment deleted.");
      setToDelete(null);
      await load();
    } catch {
      setError("Couldn't delete the enrollment. Try again.");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalRevenue = enrollments.reduce((s, e) => s + e.amountPaid, 0);
  const totalPending = enrollments.reduce((s, e) => s + e.balanceDue, 0);
  const incomplete = enrollments.filter((e) => !e.registrationComplete);
  const missingTeacher = incomplete.filter((e) => e.missingFields.includes("Assigned Teacher")).length;
  const missingHours = incomplete.filter((e) => e.missingFields.includes("Registered Hours")).length;
  const missingStart = incomplete.filter((e) => e.missingFields.includes("Start Date")).length;

  const { slice, page, pages, setPage, total } = usePagination(enrollments, 50);

  return (
    <>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingEnrollment ? "Edit Enrollment" : "New Enrollment"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" type="submit" form="enrollment-form" disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {editingEnrollment ? "Save Changes" : "Create Enrollment"}
            </Button>
          </>
        }
      >
        <form id="enrollment-form" onSubmit={save} className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert">
              {formError}
            </div>
          )}
          <RegistrationChecklist form={form} />

          <p className="placard pt-1">Student Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required htmlFor="enr-fullname">
              <Input id="enr-fullname" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label="Phone" required htmlFor="enr-phone">
              <Input id="enr-phone" required value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+971..." />
            </Field>
            <Field label="Email" htmlFor="enr-email">
              <Input id="enr-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Emirates ID" htmlFor="enr-eid">
              <Input id="enr-eid" value={form.emiratesId} onChange={(e) => set("emiratesId", e.target.value)} />
            </Field>
            <Field label="Nationality" htmlFor="enr-nationality">
              <Input id="enr-nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
          </div>

          <p className="placard pt-1">Course</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course" required htmlFor="enr-course">
              <Select id="enr-course" value={form.course} onChange={(e) => set("course", e.target.value)}>
                {courseList.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Batch" htmlFor="enr-batch">
              <Input id="enr-batch" value={form.batchName} onChange={(e) => set("batchName", e.target.value)} placeholder="AI-Batch-1" />
            </Field>
            <Field label="Start date">
              <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} max={form.endDate || undefined} />
            </Field>
            <Field label="End date">
              <DatePicker value={form.endDate} onChange={(v) => set("endDate", v)} min={form.startDate || undefined} />
            </Field>
            {/* A student may be taught by more than one trainer. The first
                selected is the primary — pay and class records default to
                them, and the order is preserved. */}
            <div className="sm:col-span-2">
              <Field
                label="Assigned Trainers"
                error={teachersError
                  ? "Trainer list failed to load — close and reopen this panel to retry."
                  : form.teacherIds.length === 0 ? "Required to complete registration" : undefined}
                help={form.teacherIds.length > 1
                  ? `${teacherNameFor(form.teacherIds[0])} is the primary trainer.`
                  : "Select one or more. Click again to remove."}
              >
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Assigned trainers">
                  {teachers.length === 0 && !teachersError && (
                    <span className="text-xs text-faint">No active trainers yet.</span>
                  )}
                  {teachers.map((t) => {
                    const idx = form.teacherIds.indexOf(t.id);
                    const picked = idx >= 0;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={picked}
                        onClick={() => toggleTeacher(t.id)}
                        className={`inline-flex items-center gap-1.5 rounded-ctl border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          picked
                            ? "border-phos/60 bg-[var(--lamp-ok-bg)] text-phos"
                            : "border-bezel-strong text-dim hover:border-phos hover:text-phos"
                        }`}
                      >
                        {picked && idx === 0 && (
                          <span className="placard text-[9px] text-phos">1st</span>
                        )}
                        {t.fullName}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            {/* Trainer pay for THIS registration — rates differ by course, so
                they belong here, not on the trainer's profile. */}
            {form.teacherIds.length > 0 && (() => {
              // The rate belongs to the registration, so it covers whoever
              // teaches it; the primary trainer's default is the fallback.
              const t = teachers.find((x) => x.id === form.teacherIds[0]);
              const many = form.teacherIds.length > 1;
              const fallback = t?.paymentRate
                ? `Applies to every trainer on this registration. Leave blank to use ${t.fullName}'s default: AED ${t.paymentRate.toLocaleString()} ${(t.paymentType || "").toLowerCase()}`
                : many
                  ? "Applies to every trainer on this registration. No default rate is set on the primary trainer — set one here, or on the Trainers page."
                  : `${t?.fullName ?? "This trainer"} has no default rate — set one here, or on the Trainers page.`;
              return (
                <>
                  <Field label="Trainer Pay Rate (AED)" htmlFor="enr-pay-rate" help={fallback}>
                    <Input
                      id="enr-pay-rate"
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.teacherPayRate}
                      onChange={(e) => set("teacherPayRate", e.target.value)}
                      placeholder="e.g. 80"
                    />
                  </Field>
                  <Field
                    label="Pay Basis"
                    htmlFor="enr-pay-basis"
                    help={
                      form.teacherPayBasis === "Fixed for Course"
                        ? "Paid once for the whole course, not per session."
                        : form.teacherPayBasis === "Per Class"
                          ? "Paid per session held, whatever its length."
                          : "Paid per hour actually delivered."
                    }
                  >
                    <Select
                      id="enr-pay-basis"
                      value={form.teacherPayBasis}
                      onChange={(e) => set("teacherPayBasis", e.target.value)}
                      disabled={!form.teacherPayRate}
                    >
                      {teacherPayBases.map((b) => <option key={b}>{b}</option>)}
                    </Select>
                  </Field>
                </>
              );
            })()}
            <Field
              label="Registered Hours"
              htmlFor="enr-hours"
              error={!form.totalRegisteredHours ? "Required to complete registration" : undefined}
            >
              <Input id="enr-hours" type="number" min="0" step="0.5" value={form.totalRegisteredHours} onChange={(e) => set("totalRegisteredHours", e.target.value)} placeholder="e.g. 40" />
            </Field>
            <Field
              label="Expected Completion"
              error={!form.expectedCompletionDate ? "Required to complete registration" : undefined}
            >
              <DatePicker value={form.expectedCompletionDate} onChange={(v) => set("expectedCompletionDate", v)} min={form.startDate || undefined} />
            </Field>
            <Field label="Schedule" htmlFor="enr-schedule">
              <Input id="enr-schedule" value={form.schedule} onChange={(e) => set("schedule", e.target.value)} placeholder="Sun/Tue 7pm" />
            </Field>
            <Field label="Format" htmlFor="enr-format">
              <Select id="enr-format" value={form.format} onChange={(e) => set("format", e.target.value)}>
                {scheduleFormats.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
            <Field label="Status" htmlFor="enr-status">
              <Select id="enr-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {enrollmentStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <p className="placard pt-1">Payment</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total fee (AED)" htmlFor="enr-fee">
              <Input id="enr-fee" type="number" min="0" value={form.totalFee} onChange={(e) => set("totalFee", e.target.value)} />
            </Field>
            <Field label="Amount paid (AED)" htmlFor="enr-paid">
              <Input id="enr-paid" type="number" min="0" value={form.amountPaid} onChange={(e) => set("amountPaid", e.target.value)} />
            </Field>
            <Field label="Payment status" htmlFor="enr-paystatus">
              <Select id="enr-paystatus" value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>
                {paymentStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Payment method" htmlFor="enr-paymethod">
              <Select id="enr-paymethod" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
                {paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="enr-notes">
            <Textarea id="enr-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </form>
      </Drawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete Enrollment"
        message={toDelete ? `This permanently removes the enrollment for ${toDelete.fullName}. This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleting}
      />

      <div className="space-y-4">
        <PageHeader
          title="Enrollments"
          subtitle="Track student registrations, payments, and course status."
          actions={
            <Button variant="solid" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden /> New Enrollment
            </Button>
          }
        />

        {/* Revenue summary */}
        {enrollments.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Instrument label="Collected Revenue" value={fmtCurrency(totalRevenue)} tone="phos" sub="Across the filtered enrollments" />
            {totalPending > 0 && (
              <Instrument label="Balance Due" value={fmtCurrency(totalPending)} tone="alert" sub="Outstanding across the filtered enrollments" />
            )}
          </div>
        )}

        {(notice || error) && (
          <div className="space-y-2">
            {notice && (
              <div role="status" className="flex items-center justify-between rounded-card border border-phos/30 bg-[var(--lamp-ok-bg)] px-4 py-3 text-sm font-semibold text-phos">
                <span>{notice}</span>
                <Button variant="ghost" size="iconSm" onClick={() => setNotice("")} aria-label="Dismiss message">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-center justify-between rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert">
                <span>{error}</span>
                <Button variant="ghost" size="iconSm" onClick={() => setError("")} aria-label="Dismiss error">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Incomplete registrations — action required */}
        {incomplete.length > 0 && (
          <div role="alert" className="rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-alert">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {incomplete.length} incomplete registration{incomplete.length > 1 ? "s" : ""} — action required
              </p>
              <span className="readout text-xs font-medium text-alert" data-numeric>{missingTeacher} missing teacher</span>
              <span className="readout text-xs font-medium text-alert" data-numeric>{missingHours} missing hours</span>
              <span className="readout text-xs font-medium text-alert" data-numeric>{missingStart} missing start date</span>
              <Button
                variant="danger"
                size="sm"
                className="ml-auto"
                onClick={() => { const first = incomplete[0]; if (first) openEdit(first); }}
              >
                Complete Registration
              </Button>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          />
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search enrollments…"
            aria-label="Search enrollments"
            className="min-w-52 flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="w-auto"
          >
            <option value="all">All statuses</option>
            {enrollmentStatuses.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
            aria-label="Filter by payment status"
            className="w-auto"
          >
            <option value="all">All payment statuses</option>
            {paymentStatuses.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>

        {loadFailed ? (
          <LoadError message="Couldn't load enrollments. Check your connection and retry." onRetry={() => void load()} />
        ) : (
          <TableShell>
            {loading ? (
              <SkeletonRows rows={8} cols={6} />
            ) : enrollments.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No enrollments yet"
                description="Create an enrollment or convert an approved enrollment request."
                action={
                  <Button variant="primary" size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden /> New Enrollment
                  </Button>
                }
              />
            ) : (
              <>
                <Table>
                  <THead>
                    <tr>
                      <Th>ID</Th>
                      <Th>Student</Th>
                      <Th>Course</Th>
                      <Th>Status</Th>
                      <Th>Payment</Th>
                      <Th numeric>Paid</Th>
                      <Th numeric>Balance</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </THead>
                  <tbody>
                    {slice.map((e) => (
                      <Tr key={e.id} clickable onClick={() => openEdit(e)}>
                        <Td className="readout text-xs text-faint" data-numeric>{e.enrollmentId}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-ink">{e.fullName}</p>
                            {!e.registrationComplete && (
                              <Lamp variant="alert" title={`Missing: ${e.missingFields.join(", ")}`}>
                                Incomplete
                              </Lamp>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-dim">
                            <span className="readout" data-numeric>{e.phone}</span>
                            <a
                              href={(buildWhatsAppUrl(e.phone) ?? "#")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-phos hover:underline"
                              aria-label={`WhatsApp ${e.fullName}`}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <MessageCircle className="h-3 w-3" aria-hidden />
                            </a>
                          </div>
                        </Td>
                        <Td className="text-dim">
                          {e.course}{e.batchName ? ` · ${e.batchName}` : ""}
                          <p className="text-xs text-faint">
                            {e.teacherName ? `Teacher: ${e.teacherName}` : "No teacher"}
                            {e.totalRegisteredHours ? ` · ${e.completedHours}/${e.totalRegisteredHours}h` : ""}
                          </p>
                        </Td>
                        <Td><StatusBadge status={e.status} /></Td>
                        <Td><Lamp variant={PAY_LAMP[e.paymentStatus] ?? "off"}>{e.paymentStatus}</Lamp></Td>
                        <Td numeric className="font-semibold text-phos">{fmtCurrency(e.amountPaid)}</Td>
                        <Td numeric>
                          {e.balanceDue > 0 ? (
                            <span className="font-bold text-alert">{fmtCurrency(e.balanceDue)}</span>
                          ) : (
                            <span className="text-xs text-faint">Cleared</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                              aria-label={`Edit enrollment for ${e.fullName}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              className="text-alert hover:text-alert"
                              onClick={(ev) => { ev.stopPropagation(); setToDelete(e); }}
                              aria-label={`Delete enrollment for ${e.fullName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                <TableFooter>
                  <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
                </TableFooter>
              </>
            )}
          </TableShell>
        )}
      </div>
    </>
  );
}
