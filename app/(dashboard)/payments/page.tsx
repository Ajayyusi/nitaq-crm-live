"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, CreditCard, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import DatePicker from "@/components/shared/DatePicker";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field, SearchInput } from "@/components/ui/input";
import { Drawer, ConfirmDialog } from "@/components/ui/dialog";
import {
  TableShell, Table, THead, Th, Tr, Td, TableFooter, usePagination, Pagination,
} from "@/components/ui/table";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";
import { courseList } from "@/constants/leads";
import {
  paymentMethods, paymentTypes, txStatuses,
} from "@/constants/modelConstants";
import { thisMonthRange, describeRange } from "@/lib/dateRange";

type Payment = {
  id: string; paymentId: string; studentName: string; studentPhone: string;
  course: string; amount: number; paymentType: string; paymentMethod: string;
  status: string; datePaid: string; dueDate: string; receiptRef: string;
  notes: string; recordedBy: string; createdAt: string;
  enrollmentId: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
};

type Enrollment = {
  id: string; enrollmentId: string; fullName: string; phone: string;
  course: string; totalFee: number; amountPaid: number; balanceDue: number;
};

const today = new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Debounce a changing value; used so typing doesn't fire a fetch per keystroke. */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const BLANK = {
  studentName: "", studentPhone: "", course: "", amount: "",
  paymentType: "Full Payment", paymentMethod: "Cash", status: "Received",
  datePaid: today, dueDate: "", receiptRef: "", notes: "", recordedBy: "",
  enrollmentId: "",
  installmentNumber: "", totalInstallments: "",
};

type FieldErrors = { studentName?: string; amount?: string };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dateFrom, setDateFrom] = useState(() => thisMonthRange().from);
  const [dateTo, setDateTo] = useState(() => thisMonthRange().to);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  // Honor deep links like /payments?status=Overdue (sent from notifications).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s && (txStatuses as readonly string[]).includes(s)) setStatusFilter(s);
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (methodFilter !== "All") params.set("method", methodFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/payments?${params}`);
      const data = await res.json();
      setPayments(data.payments ?? []);
      setTotalRevenue(data.totalRevenue ?? 0);
      setTotalPending(data.totalPending ?? 0);
    } catch {
      setLoadFailed(true);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, debouncedSearch, dateFrom, dateTo]);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch("/api/enrollments");
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setEnrollments([]);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  function openNew() {
    setEditTarget(null);
    setForm({ ...BLANK });
    setFormError("");
    setFieldErrors({});
    setDrawerOpen(true);
  }

  function openEdit(p: Payment) {
    setEditTarget(p);
    setForm({
      studentName: p.studentName, studentPhone: p.studentPhone,
      course: p.course, amount: String(p.amount),
      paymentType: p.paymentType, paymentMethod: p.paymentMethod,
      status: p.status, datePaid: p.datePaid, dueDate: p.dueDate,
      receiptRef: p.receiptRef, notes: p.notes, recordedBy: p.recordedBy,
      enrollmentId: p.enrollmentId ?? "",
      installmentNumber: p.installmentNumber != null ? String(p.installmentNumber) : "",
      totalInstallments: p.totalInstallments != null ? String(p.totalInstallments) : "",
    });
    setFormError("");
    setFieldErrors({});
    setDrawerOpen(true);
  }

  function fillFromEnrollment(eid: string) {
    const e = enrollments.find((en) => en.id === eid);
    if (!e) return;
    // Count payments already linked to this enrollment to suggest next installment number
    const existingCount = payments.filter((p) => p.enrollmentId === eid).length;
    setForm((f) => ({
      ...f,
      enrollmentId: eid,
      studentName: e.fullName,
      studentPhone: e.phone,
      course: e.course,
      amount: String(e.balanceDue > 0 ? e.balanceDue : e.totalFee),
      installmentNumber: String(existingCount + 1),
    }));
    setFieldErrors({});
  }

  async function save() {
    const errors: FieldErrors = {};
    if (!form.studentName.trim()) errors.studentName = "Enter the student's name.";
    if (!form.amount || Number(form.amount) <= 0) errors.amount = "Enter an amount greater than 0.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setFormError("");
    const payload = {
      studentName: form.studentName,
      studentPhone: form.studentPhone,
      course: form.course,
      amount: Number(form.amount),
      paymentType: form.paymentType,
      paymentMethod: form.paymentMethod,
      status: form.status,
      datePaid: form.datePaid || undefined,
      dueDate: form.dueDate || undefined,
      receiptRef: form.receiptRef,
      notes: form.notes,
      recordedBy: form.recordedBy,
      enrollmentId: form.enrollmentId || undefined,
      installmentNumber: form.installmentNumber ? Number(form.installmentNumber) : undefined,
      totalInstallments: form.totalInstallments ? Number(form.totalInstallments) : undefined,
    };
    try {
      const url = editTarget ? `/api/payments/${editTarget.id}` : "/api/payments";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (res.message && !res.payment) throw new Error(res.message);
      setDrawerOpen(false);
      fetchPayments();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save this receipt. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await fetch(`/api/payments/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      void fetchPayments();
    } catch {
      setDeleteError("Couldn't delete this receipt. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  const overdue = payments.filter((p) => p.status === "Overdue");
  const periodLabel = describeRange(dateFrom, dateTo);
  const { slice, page, pages, setPage, total } = usePagination(payments, 50);

  const enr = form.enrollmentId ? enrollments.find((e) => e.id === form.enrollmentId) : undefined;

  return (
    <div>
      <PageHeader
        title="Receipts"
        subtitle="Receipts from students — income, instalments and overdue balances"
        actions={
          <Button variant="solid" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden /> Record Receipt
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Overdue annunciator */}
        {overdue.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3"
          >
            <span className="mt-0.5 h-2 w-2 flex-shrink-0 animate-pulse rounded-lamp bg-alert" aria-hidden />
            <p className="text-sm text-ink">
              <span className="font-bold text-alert">
                {overdue.length} overdue receipt{overdue.length > 1 ? "s" : ""}:
              </span>{" "}
              {overdue.slice(0, 3).map((p) => p.studentName).join(", ")}
              {overdue.length > 3 && ` +${overdue.length - 3} more`}
            </p>
          </div>
        )}

        {/* Instruments */}
        <InstrumentRow className="xl:grid-cols-4">
          <Instrument label={`Received (${periodLabel})`} value={fmt(totalRevenue)} tone="phos" />
          <Instrument label="Pending / Overdue" value={fmt(totalPending)} tone="caution" sub="Not yet collected" />
          <Instrument
            label="Overdue Records"
            value={overdue.length}
            tone={overdue.length > 0 ? "alert" : "ink"}
            sub="In current view"
          />
          <Instrument label="Total Records" value={payments.length} sub="In current view" />
        </InstrumentRow>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          />
          <SearchInput
            placeholder="Search name, ID, receipt…"
            aria-label="Search receipts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto"
          >
            <option value="All">All Statuses</option>
            {txStatuses.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select
            aria-label="Filter by method"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-auto"
          >
            <option value="All">All Methods</option>
            {paymentMethods.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>

        {/* Table */}
        {loadFailed ? (
          <LoadError
            message="Couldn't load receipts. Check your connection and retry."
            onRetry={fetchPayments}
          />
        ) : loading ? (
          <TableShell>
            <SkeletonRows rows={6} cols={7} />
          </TableShell>
        ) : payments.length === 0 ? (
          <TableShell>
            <EmptyState
              icon={CreditCard}
              title="No receipts found"
              description="No receipts match the current filters. Record one to start tracking income."
              action={
                <Button variant="primary" onClick={openNew}>
                  <Plus className="h-4 w-4" aria-hidden /> Record Receipt
                </Button>
              }
            />
          </TableShell>
        ) : (
          <TableShell>
            <Table className="min-w-[820px]">
              <THead>
                <tr>
                  <Th>ID</Th>
                  <Th>Student</Th>
                  <Th>Course</Th>
                  <Th numeric>Amount</Th>
                  <Th>Type / Inst</Th>
                  <Th>Method</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </tr>
              </THead>
              <tbody>
                {slice.map((p) => (
                  <Tr
                    key={p.id}
                    clickable
                    className={p.status === "Overdue" ? "bg-[var(--lamp-alert-bg)]" : undefined}
                    onClick={() => openEdit(p)}
                  >
                    <Td className="readout text-xs text-faint" data-numeric>{p.paymentId}</Td>
                    <Td>
                      <div className="font-semibold">{p.studentName}</div>
                      {p.studentPhone && <div className="readout text-xs text-faint" data-numeric>{p.studentPhone}</div>}
                    </Td>
                    <Td className="max-w-[160px] truncate text-dim" title={p.course || undefined}>
                      {p.course || "—"}
                    </Td>
                    <Td numeric className="whitespace-nowrap font-semibold">
                      {fmt(p.amount)}
                      {p.paymentType === "Refund" && <span className="ml-1 text-xs text-alert">(refund)</span>}
                    </Td>
                    <Td className="text-dim">
                      {p.paymentType}
                      {p.installmentNumber != null && p.totalInstallments != null && (
                        <span className="readout ml-1.5 text-xs text-faint" data-numeric>
                          {p.installmentNumber}/{p.totalInstallments}
                        </span>
                      )}
                      {p.installmentNumber != null && p.totalInstallments == null && (
                        <span className="readout ml-1.5 text-xs text-faint" data-numeric>
                          #{p.installmentNumber}
                        </span>
                      )}
                    </Td>
                    <Td className="text-dim">{p.paymentMethod}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
                    <Td className="whitespace-nowrap text-dim">
                      {p.datePaid || (p.dueDate ? `Due ${p.dueDate}` : "—")}
                    </Td>
                    <Td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => openEdit(p)}
                        aria-label={`Edit receipt ${p.paymentId}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-dim hover:text-alert"
                        onClick={() => { setDeleteError(""); setDeleteTarget(p); }}
                        aria-label={`Delete receipt ${p.paymentId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
            </TableFooter>
          </TableShell>
        )}
      </div>

      {/* Record / edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? `Edit ${editTarget.paymentId}` : "Record Receipt"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Update Receipt" : "Record Receipt"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
              {formError}
            </p>
          )}

          {/* Link to enrollment */}
          <div className="overflow-hidden rounded-ctl border border-bezel">
            <div className="placard border-b border-bezel bg-well px-4 py-2.5">
              Link to Enrollment (optional)
            </div>
            <div className="space-y-2 px-4 py-3">
              <Select
                aria-label="Link to enrollment"
                value={form.enrollmentId}
                onChange={(e) => {
                  if (e.target.value) fillFromEnrollment(e.target.value);
                  else setForm((f) => ({ ...f, enrollmentId: "" }));
                }}
              >
                <option value="">— No enrollment linked —</option>
                {enrollments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} · {e.course} · bal: {fmt(e.balanceDue)}
                  </option>
                ))}
              </Select>
              {enr && (
                <p className="readout flex flex-wrap gap-x-3 text-xs text-dim" data-numeric>
                  <span>Total: <strong className="text-ink">{fmt(enr.totalFee)}</strong></span>
                  <span>Paid: <strong className="text-ink">{fmt(enr.amountPaid)}</strong></span>
                  <span>
                    Balance:{" "}
                    <strong className={enr.balanceDue > 0 ? "text-caution" : "text-ink"}>
                      {fmt(enr.balanceDue)}
                    </strong>
                  </span>
                </p>
              )}
            </div>
          </div>

          <Field label="Student Name" required error={fieldErrors.studentName} htmlFor="rcpt-student">
            <Input
              id="rcpt-student"
              value={form.studentName}
              onChange={(e) => {
                setForm((f) => ({ ...f, studentName: e.target.value }));
                if (fieldErrors.studentName) setFieldErrors((fe) => ({ ...fe, studentName: undefined }));
              }}
              placeholder="Full name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" htmlFor="rcpt-phone">
              <Input
                id="rcpt-phone"
                value={form.studentPhone}
                onChange={(e) => setForm((f) => ({ ...f, studentPhone: e.target.value }))}
                placeholder="+971…"
              />
            </Field>
            <Field label="Amount (AED)" required error={fieldErrors.amount} htmlFor="rcpt-amount">
              <Input
                id="rcpt-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => {
                  setForm((f) => ({ ...f, amount: e.target.value }));
                  if (fieldErrors.amount) setFieldErrors((fe) => ({ ...fe, amount: undefined }));
                }}
                placeholder="0.00"
              />
            </Field>
          </div>

          <Field label="Course" htmlFor="rcpt-course">
            <Select
              id="rcpt-course"
              value={form.course}
              onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
            >
              <option value="">— Select course —</option>
              {courseList.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Type" htmlFor="rcpt-type">
              <Select
                id="rcpt-type"
                value={form.paymentType}
                onChange={(e) => setForm((f) => ({ ...f, paymentType: e.target.value }))}
              >
                {paymentTypes.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Method" htmlFor="rcpt-method">
              <Select
                id="rcpt-method"
                value={form.paymentMethod}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              >
                {paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Instalment #" help="Leave blank for one-off receipts">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 1"
                  aria-label="Instalment number"
                  value={form.installmentNumber}
                  onChange={(e) => setForm((f) => ({ ...f, installmentNumber: e.target.value }))}
                />
                <span className="whitespace-nowrap text-xs text-faint">of</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 3"
                  aria-label="Total instalments"
                  value={form.totalInstallments}
                  onChange={(e) => setForm((f) => ({ ...f, totalInstallments: e.target.value }))}
                />
              </div>
            </Field>
            <Field label="Status" htmlFor="rcpt-status">
              <Select
                id="rcpt-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {txStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Date Paid">
            <DatePicker
              value={form.datePaid}
              onChange={(v) => setForm((f) => ({ ...f, datePaid: v }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Due Date">
              <DatePicker
                value={form.dueDate}
                onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))}
              />
            </Field>
            <Field label="Receipt Ref" htmlFor="rcpt-ref">
              <Input
                id="rcpt-ref"
                value={form.receiptRef}
                onChange={(e) => setForm((f) => ({ ...f, receiptRef: e.target.value }))}
                placeholder="e.g. RCT-001"
              />
            </Field>
          </div>

          <Field label="Recorded By" htmlFor="rcpt-recorded">
            <Input
              id="rcpt-recorded"
              value={form.recordedBy}
              onChange={(e) => setForm((f) => ({ ...f, recordedBy: e.target.value }))}
              placeholder="Staff name"
            />
          </Field>

          <Field label="Notes" htmlFor="rcpt-notes">
            <Textarea
              id="rcpt-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes…"
            />
          </Field>
        </div>
      </Drawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete Receipt"
        confirmLabel="Delete"
        message={
          <>
            Delete receipt <strong className="text-ink">{deleteTarget?.paymentId}</strong> for{" "}
            <strong className="text-ink">{deleteTarget?.studentName}</strong>? This permanently
            removes the financial record and cannot be undone.
            {deleteError && (
              <span role="alert" className="mt-2 block font-semibold text-alert">{deleteError}</span>
            )}
          </>
        }
      />
    </div>
  );
}
