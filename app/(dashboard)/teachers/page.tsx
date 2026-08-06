"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Edit3, LogIn, MessageCircle, Plus, Trash2, UserCheck, X } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  trainerStatuses,
  tamamStatuses,
  contractStatuses,
  trainerPaymentTypes as paymentTypes,
} from "@/constants/modelConstants";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatCurrency, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
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

type Trainer = {
  id: string; fullName: string; fullNameAr: string; phone: string; email: string;
  emiratesId: string; nationality: string; specialisation: string; qualifications: string;
  tamamStatus: string; tamamNumber: string; contractStatus: string; contractStartDate: string;
  contractEndDate: string; paymentRate: number | null; paymentType: string; status: string;
  notes: string; contractExpiring: boolean; tamamAlert: boolean; contractAlert: boolean;
};

type FormState = {
  fullName: string; fullNameAr: string; phone: string; email: string; emiratesId: string;
  nationality: string; specialisation: string; qualifications: string; tamamStatus: string;
  tamamNumber: string; contractStatus: string; contractStartDate: string; contractEndDate: string;
  paymentRate: string; paymentType: string; status: string; notes: string;
};

const emptyForm: FormState = {
  fullName: "", fullNameAr: "", phone: "", email: "", emiratesId: "",
  nationality: "", specialisation: "", qualifications: "", tamamStatus: "Not Registered",
  tamamNumber: "", contractStatus: "No Contract", contractStartDate: "", contractEndDate: "",
  paymentRate: "", paymentType: "Per Hour", status: "Active", notes: "",
};

/**
 * Older trainers were saved as "Per Session", which is no longer offered in
 * the dropdown. Show it as the "Per Class" it has always behaved as, so the
 * select never renders with nothing selected and silently saves the legacy
 * value back — that made hourly rates pay out as a single class.
 */
function uiPaymentType(v: string) {
  return v === "Per Session" ? "Per Class" : v;
}

function getErr(v: unknown, fb: string) {
  if (v && typeof v === "object" && "message" in v && typeof v.message === "string") return v.message;
  return fb;
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

export default function TrainersPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [openingAs, setOpeningAs] = useState("");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Trainer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/teachers?${params}`, { cache: "no-store" });
      const data = await res.json();
      setTrainers(data.trainers ?? []);
    } catch {
      setLoadError("Couldn't load trainers. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setEditingTrainer(null); setForm(emptyForm); setFormError(""); setFieldErrors({}); setDrawerOpen(true);
  }
  function openEdit(t: Trainer) {
    setEditingTrainer(t);
    setForm({
      fullName: t.fullName, fullNameAr: t.fullNameAr, phone: t.phone, email: t.email,
      emiratesId: t.emiratesId, nationality: t.nationality, specialisation: t.specialisation,
      qualifications: t.qualifications, tamamStatus: t.tamamStatus, tamamNumber: t.tamamNumber,
      contractStatus: t.contractStatus, contractStartDate: t.contractStartDate,
      contractEndDate: t.contractEndDate, paymentRate: t.paymentRate?.toString() ?? "",
      paymentType: uiPaymentType(t.paymentType), status: t.status, notes: t.notes,
    });
    setFormError(""); setFieldErrors({}); setDrawerOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true); setFormError("");
    try {
      const url = editingTrainer ? `/api/teachers/${editingTrainer.id}` : "/api/teachers";
      const method = editingTrainer ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, paymentRate: form.paymentRate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(editingTrainer ? "Trainer updated." : "Trainer added.");
      setDrawerOpen(false);
      await load();
    } catch (caught) { setFormError(getErr(caught, "Couldn't save the trainer. Check the fields and retry.")); }
    finally { setSaving(false); }
  }

  async function deleteTrainer(t: Trainer) {
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotice("Trainer deleted.");
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
      setActionError("Couldn't delete the trainer. Retry, or contact your administrator.");
    } finally {
      setDeleting(false);
    }
  }

  /** Admin: open the CRM in a new tab as this trainer (audited, single-use link). */
  async function openAsTrainer(t: Trainer) {
    setOpeningAs(t.id);
    setActionError("");
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: t.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      window.open(d.url, "_blank", "noopener");
    } catch (err) {
      setActionError((err as Error).message || "Couldn't open the trainer session. Retry.");
    } finally {
      setOpeningAs("");
    }
  }

  const alerts = trainers.filter((t) => t.tamamAlert || t.contractAlert || t.contractExpiring);
  const { slice, page, pages, setPage, total } = usePagination(trainers);

  return (
    <div>
      <PageHeader
        title="Trainers"
        subtitle="Trainer profiles, contracts, Tamam status, and payment rates"
        actions={
          <Button variant="solid" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Add Trainer
          </Button>
        }
      />

      {alerts.length > 0 && (
        <div role="status" className="mb-4 rounded-card border border-caution/30 bg-[var(--lamp-caution-bg)] px-4 py-3">
          <div className="mb-1.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-caution" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-caution">Trainer Alerts</span>
          </div>
          <ul className="space-y-0.5">
            {alerts.map((t) => (
              <li key={t.id} className="text-xs text-dim">
                <span className="font-semibold text-ink">{t.fullName}:</span>{" "}
                {t.tamamAlert && "Tamam registration pending. "}
                {t.contractAlert && "Contract expired. "}
                {t.contractExpiring && !t.contractAlert && "Contract expiring within 30 days. "}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          placeholder="Search trainers"
          aria-label="Search trainers"
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
          {trainerStatuses.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={6} cols={6} />
          ) : trainers.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No trainers found"
              description={
                debouncedSearch.trim() || statusFilter !== "all"
                  ? "No trainers match the current filters. Clear them to see everyone."
                  : "Add the first trainer profile to get started."
              }
              action={
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden /> Add Trainer
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th>Trainer</Th>
                    <Th>Phone</Th>
                    <Th>Specialisation</Th>
                    <Th numeric>Rate</Th>
                    <Th>Status</Th>
                    <Th className="text-right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((t) => (
                    <Tr key={t.id} clickable onClick={() => openEdit(t)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-bezel bg-well text-xs font-bold text-dim"
                          >
                            {getInitials(t.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold">{t.fullName}</p>
                            {t.fullNameAr && (
                              <p className="truncate text-xs text-dim" dir="rtl">{t.fullNameAr}</p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td><span className="readout text-xs" data-numeric>{t.phone}</span></Td>
                      <Td className="text-dim">
                        <span className="block max-w-[16rem] truncate" title={t.specialisation || undefined}>
                          {t.specialisation || "—"}
                        </span>
                      </Td>
                      <Td numeric>
                        {t.paymentRate ? (
                          <>
                            {formatCurrency(t.paymentRate)}
                            <span className="block text-[11px] text-faint">{uiPaymentType(t.paymentType)}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={t.status} />
                          {t.tamamAlert && <Lamp variant="caution">Tamam Pending</Lamp>}
                          {t.contractAlert && <Lamp variant="alert">Contract Expired</Lamp>}
                          {t.contractExpiring && !t.contractAlert && <Lamp variant="caution">Contract Expiring</Lamp>}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={buildWhatsAppUrl(t.phone) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open WhatsApp chat with ${t.fullName}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-ctl border border-transparent text-phos transition-colors hover:bg-well"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              disabled={openingAs === t.id}
                              title={`Open the CRM as ${t.fullName} in a new tab`}
                              aria-label={`Open the CRM as ${t.fullName} in a new tab`}
                              className="text-caution hover:text-caution"
                              onClick={(e) => { e.stopPropagation(); void openAsTrainer(t); }}
                            >
                              {openingAs === t.id ? <Spinner className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={`Edit ${t.fullName}`}
                            onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-alert hover:text-alert"
                            aria-label={`Delete ${t.fullName}`}
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }}
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

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTrainer ? "Edit Trainer" : "Add Trainer"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" type="submit" form="trainer-form" disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {editingTrainer ? "Save Changes" : "Add Trainer"}
            </Button>
          </>
        }
      >
        <form id="trainer-form" onSubmit={save} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert">
              {formError}
            </div>
          )}

          <p className="placard">Personal Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name (EN)" required error={fieldErrors.fullName} htmlFor="trainer-name">
              <Input
                id="trainer-name"
                value={form.fullName}
                aria-invalid={fieldErrors.fullName ? true : undefined}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </Field>
            <Field label="Full Name (AR)" htmlFor="trainer-name-ar">
              <Input id="trainer-name-ar" dir="rtl" value={form.fullNameAr} onChange={(e) => set("fullNameAr", e.target.value)} />
            </Field>
            <Field label="Phone" required error={fieldErrors.phone} htmlFor="trainer-phone">
              <Input
                id="trainer-phone"
                value={form.phone}
                aria-invalid={fieldErrors.phone ? true : undefined}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+971..."
              />
            </Field>
            <Field label="Email" htmlFor="trainer-email">
              <Input id="trainer-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Emirates ID" htmlFor="trainer-eid">
              <Input id="trainer-eid" value={form.emiratesId} onChange={(e) => set("emiratesId", e.target.value)} />
            </Field>
            <Field label="Nationality" htmlFor="trainer-nationality">
              <Input id="trainer-nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
          </div>

          <p className="placard pt-2">Professional</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Specialisation / Subjects" htmlFor="trainer-spec" className="sm:col-span-2">
              <Input id="trainer-spec" value={form.specialisation} onChange={(e) => set("specialisation", e.target.value)} />
            </Field>
            <Field label="Qualifications" htmlFor="trainer-qual" className="sm:col-span-2">
              <Textarea id="trainer-qual" rows={2} value={form.qualifications} onChange={(e) => set("qualifications", e.target.value)} />
            </Field>
          </div>

          <p className="placard pt-2">Tamam &amp; Contract</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tamam Status" htmlFor="trainer-tamam">
              <Select id="trainer-tamam" value={form.tamamStatus} onChange={(e) => set("tamamStatus", e.target.value)}>
                {tamamStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Tamam Number" htmlFor="trainer-tamam-no">
              <Input id="trainer-tamam-no" value={form.tamamNumber} onChange={(e) => set("tamamNumber", e.target.value)} />
            </Field>
            <Field label="Contract Status" htmlFor="trainer-contract">
              <Select id="trainer-contract" value={form.contractStatus} onChange={(e) => set("contractStatus", e.target.value)}>
                {contractStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Status" htmlFor="trainer-status">
              <Select id="trainer-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {trainerStatuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Contract Start">
              <DatePicker value={form.contractStartDate} onChange={(v) => set("contractStartDate", v)} max={form.contractEndDate || undefined} />
            </Field>
            <Field label="Contract End">
              <DatePicker value={form.contractEndDate} onChange={(v) => set("contractEndDate", v)} min={form.contractStartDate || undefined} />
            </Field>
            <Field
              label="Default Rate (AED)"
              htmlFor="trainer-rate"
              help="Used when a student registration doesn't set its own rate."
            >
              <Input id="trainer-rate" type="number" min="0" value={form.paymentRate} onChange={(e) => set("paymentRate", e.target.value)} />
            </Field>
            <Field
              label="Default Basis"
              htmlFor="trainer-pay-type"
              help={form.paymentType === "Monthly"
                ? "Monthly salary — per-registration rates are ignored."
                : "Per-registration rates override this."}
            >
              <Select id="trainer-pay-type" value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)}>
                {paymentTypes.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="trainer-notes">
            <Textarea id="trainer-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => { if (!deleting) setConfirmDelete(null); }}
        onConfirm={() => { if (confirmDelete) void deleteTrainer(confirmDelete); }}
        title="Delete Trainer"
        message={confirmDelete ? `Delete trainer ${confirmDelete.fullName}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleting}
      />
    </div>
  );
}
