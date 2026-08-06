"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, CheckCircle2, ChevronDown, ChevronUp, Plus, RefreshCw, Users } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Field, Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/dialog";
import { Pagination, usePagination } from "@/components/ui/table";
import { LoadError, Skeleton, Spinner } from "@/components/ui/feedback";

interface DocRecord {
  docType: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  reference: string;
  notes: string;
}

interface StaffRecord {
  id: string;
  staffName: string;
  staffRole: string;
  email: string;
  phone: string;
  documents: DocRecord[];
  notes: string;
  missingRequiredDocs: string[];
  missingCount: number;
  expiringDocs: string[];
  isActive: boolean;
}

const DOC_TYPES = [
  "DBS Check",
  "Right to Work",
  "Teaching Qualification",
  "Assessor Award (D32/D33/A1/TAQA)",
  "IQA Award (D34/V1/TAQA)",
  "CPD Record",
  "Contract",
  "ID Document",
  "Medical Certificate",
  "Other",
];

const DOC_STATUSES = ["Valid", "Expired", "Missing", "Pending Review"];

const DOC_LAMP: Record<string, LampVariant> = {
  Valid: "ok",
  Expired: "alert",
  Missing: "off",
  "Pending Review": "caution",
};

const DOC_TEXT: Record<string, string> = {
  Valid: "text-phos",
  Expired: "text-alert",
  Missing: "text-faint",
  "Pending Review": "text-caution",
};

function emptyDoc(): DocRecord {
  return { docType: DOC_TYPES[0], status: "Missing", issueDate: "", expiryDate: "", reference: "", notes: "" };
}

export default function StaffCompliancePage() {
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role) || (role !== "admin" && role !== "manager");

  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState("");
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [addDrawer, setAddDrawer] = useState(false);

  // Add form
  const [addForm, setAddForm] = useState({ staffName: "", staffRole: "", email: "", phone: "" });
  const [addError, setAddError] = useState("");
  const [addFieldErrors, setAddFieldErrors] = useState<{ staffName?: string; staffRole?: string }>({});
  const [addSaving, setAddSaving] = useState(false);

  // Editing docs per record
  const [editingDocs, setEditingDocs] = useState<Record<string, DocRecord[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/staff-compliance");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setRecords(d.records ?? []);
    } catch {
      setLoadError("Couldn't load staff compliance records. Check your connection and retry.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
    setEditingDocs((prev) => {
      if (prev[id]) return prev;
      const record = records.find((r) => r.id === id);
      return { ...prev, [id]: record ? [...record.documents] : [] };
    });
  };

  const saveDocs = async (id: string) => {
    setSaving(id);
    setDocErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/staff-compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: editingDocs[id] ?? [] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't save documents — try again.");
      setRecords((prev) => prev.map((r) => (r.id === id ? d.record : r)));
    } catch (e) {
      setDocErrors((prev) => ({ ...prev, [id]: (e as Error).message }));
    } finally {
      setSaving("");
    }
  };

  const openAddDrawer = () => {
    setAddForm({ staffName: "", staffRole: "", email: "", phone: "" });
    setAddError("");
    setAddFieldErrors({});
    setAddDrawer(true);
  };

  const addRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { staffName?: string; staffRole?: string } = {};
    if (!addForm.staffName.trim()) errs.staffName = "Full name is required.";
    if (!addForm.staffRole.trim()) errs.staffRole = "Role is required.";
    setAddFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAddSaving(true);
    setAddError("");
    try {
      const res = await fetch("/api/staff-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't add the staff member — try again.");
      setRecords((prev) => [d.record, ...prev]);
      setAddDrawer(false);
      setAddForm({ staffName: "", staffRole: "", email: "", phone: "" });
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddSaving(false);
    }
  };

  const withIssues = records.filter((r) => r.missingCount > 0 || r.expiringDocs.length > 0);
  const { slice, page, pages, setPage, total } = usePagination(records, 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Compliance"
        subtitle={`${records.length} staff member${records.length !== 1 ? "s" : ""}${withIssues.length > 0 ? ` · ${withIssues.length} with issues` : ""}`}
        actions={
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh staff records"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
            {!readOnly && (
              <Button variant="solid" onClick={openAddDrawer}>
                <Plus className="h-4 w-4" aria-hidden /> Add Staff
              </Button>
            )}
          </>
        }
      />

      {/* Expiring-document notices */}
      {records.some((r) => r.expiringDocs.length > 0) && !loadError && (
        <div className="space-y-2">
          {records
            .filter((r) => r.expiringDocs.length > 0)
            .map((r) => (
              <div
                key={r.id}
                role="status"
                className="flex flex-wrap items-center gap-2 rounded-card border border-caution/30 bg-[var(--lamp-caution-bg)] px-4 py-2.5 text-sm"
              >
                <Bell className="h-4 w-4 flex-shrink-0 text-caution" aria-hidden />
                <span className="font-semibold text-ink">{r.staffName}</span>
                <span className="text-caution">— expiring soon: {r.expiringDocs.join(", ")}</span>
              </div>
            ))}
        </div>
      )}

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-card" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff compliance records yet"
          description="Track DBS checks, assessor awards and other staff documents here."
          action={
            !readOnly ? (
              <Button variant="primary" size="sm" onClick={openAddDrawer}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add Staff
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {slice.map((record) => {
              const isOpen = expanded === record.id;
              const docs = editingDocs[record.id] ?? record.documents;
              const hasIssues = record.missingCount > 0 || record.expiringDocs.length > 0;
              return (
                <Card key={record.id} className={hasIssues ? "border-caution/30" : undefined}>
                  {/* Row header */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 rounded-card px-4 py-3 text-left transition-colors hover:bg-well"
                    onClick={() => toggleExpand(record.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{record.staffName}</p>
                        <span className="text-xs text-dim">{record.staffRole}</span>
                        {record.missingCount > 0 && (
                          <Lamp variant="alert">{record.missingCount} missing</Lamp>
                        )}
                        {record.expiringDocs.length > 0 && <Lamp variant="caution">Expiring</Lamp>}
                        {record.missingCount === 0 && record.expiringDocs.length === 0 && (
                          <Lamp variant="ok">
                            <CheckCircle2 className="h-3 w-3" aria-hidden /> Compliant
                          </Lamp>
                        )}
                      </div>
                      {record.email && <p className="mt-0.5 text-xs text-faint">{record.email}</p>}
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0 text-dim" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-dim" aria-hidden />
                    )}
                  </button>

                  {/* Expanded docs */}
                  {isOpen && (
                    <div className="border-t border-bezel px-4 py-4">
                      <div className="space-y-2">
                        {DOC_TYPES.map((docType) => {
                          const existing = docs.find((d) => d.docType === docType);
                          const status = existing?.status ?? "Missing";
                          return (
                            <div
                              key={docType}
                              className="flex flex-wrap items-center gap-3 rounded-ctl border border-bezel px-3 py-2"
                            >
                              <span className="min-w-[140px] flex-1 text-sm text-ink">{docType}</span>
                              {readOnly ? (
                                <Lamp variant={DOC_LAMP[status] ?? "off"}>{status}</Lamp>
                              ) : (
                                <>
                                  <Select
                                    value={status}
                                    aria-label={`${docType} status for ${record.staffName}`}
                                    onChange={(e) => {
                                      const newStatus = e.target.value;
                                      setEditingDocs((prev) => {
                                        const list = [...(prev[record.id] ?? record.documents)];
                                        const idx = list.findIndex((d) => d.docType === docType);
                                        if (idx >= 0) {
                                          list[idx] = { ...list[idx], status: newStatus };
                                        } else {
                                          list.push({ ...emptyDoc(), docType, status: newStatus });
                                        }
                                        return { ...prev, [record.id]: list };
                                      });
                                    }}
                                    className={`h-8 w-auto pr-7 text-xs font-semibold ${DOC_TEXT[status] ?? ""}`}
                                  >
                                    {DOC_STATUSES.map((s) => (
                                      <option key={s}>{s}</option>
                                    ))}
                                  </Select>
                                  <DatePicker
                                    compact
                                    placeholder="Expiry"
                                    value={existing?.expiryDate ?? ""}
                                    onChange={(v) => {
                                      setEditingDocs((prev) => {
                                        const list = [...(prev[record.id] ?? record.documents)];
                                        const idx = list.findIndex((d) => d.docType === docType);
                                        if (idx >= 0) {
                                          list[idx] = { ...list[idx], expiryDate: v };
                                        } else {
                                          list.push({ ...emptyDoc(), docType, expiryDate: v });
                                        }
                                        return { ...prev, [record.id]: list };
                                      });
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {!readOnly && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            variant="primary"
                            onClick={() => void saveDocs(record.id)}
                            disabled={!!saving}
                          >
                            {saving === record.id && <Spinner className="h-4 w-4" />}
                            Save Documents
                          </Button>
                          {docErrors[record.id] && (
                            <span role="alert" className="text-sm font-semibold text-alert">
                              {docErrors[record.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="flex items-center rounded-card border border-bezel bg-face px-4 py-2.5 text-xs text-dim">
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
            </div>
          )}
        </>
      )}

      {/* Add drawer */}
      <Drawer
        open={addDrawer}
        onClose={() => setAddDrawer(false)}
        title="Add Staff Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddDrawer(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button type="submit" form="staff-add-form" variant="solid" disabled={addSaving}>
              {addSaving && <Spinner className="h-3.5 w-3.5" />}
              {addSaving ? "Saving…" : "Add Staff Member"}
            </Button>
          </>
        }
      >
        <form id="staff-add-form" onSubmit={addRecord} noValidate className="space-y-4">
          {addError && (
            <p
              role="alert"
              className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert"
            >
              {addError}
            </p>
          )}
          <Field label="Full Name" required htmlFor="staff-name" error={addFieldErrors.staffName}>
            <Input
              id="staff-name"
              value={addForm.staffName}
              onChange={(e) => setAddForm((f) => ({ ...f, staffName: e.target.value }))}
              placeholder="e.g. Ahmed Al Rashidi"
            />
          </Field>
          <Field label="Role" required htmlFor="staff-role" error={addFieldErrors.staffRole}>
            <Input
              id="staff-role"
              value={addForm.staffRole}
              onChange={(e) => setAddForm((f) => ({ ...f, staffRole: e.target.value }))}
              placeholder="e.g. Assessor"
            />
          </Field>
          <Field label="Email" htmlFor="staff-email" help="Optional">
            <Input
              id="staff-email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Phone" htmlFor="staff-phone" help="Optional">
            <Input
              id="staff-phone"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
