"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

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

const statusColor: Record<string, string> = {
  Valid:           "text-green-600 dark:text-green-400",
  Expired:         "text-red-600 dark:text-red-400",
  Missing:         "text-gray-400",
  "Pending Review":"text-amber-600 dark:text-amber-400",
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState("");
  const [addDrawer, setAddDrawer] = useState(false);

  // Add form
  const [addForm, setAddForm] = useState({ staffName: "", staffRole: "", email: "", phone: "" });
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Editing docs per record
  const [editingDocs, setEditingDocs] = useState<Record<string, DocRecord[]>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/staff-compliance")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

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
    try {
      const res = await fetch(`/api/staff-compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: editingDocs[id] ?? [] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setRecords((prev) => prev.map((r) => (r.id === id ? d.record : r)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving("");
    }
  };

  const addRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true); setAddError("");
    try {
      const res = await fetch("/api/staff-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
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

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Staff Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {records.length} staff member{records.length !== 1 ? "s" : ""}
            {withIssues.length > 0 ? ` · ${withIssues.length} with issues` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          {!readOnly && (
            <button
              onClick={() => setAddDrawer(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1B5E20]"
            >
              <Plus className="h-4 w-4" /> Add Staff
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {withIssues.length > 0 && (
        <div className="space-y-2">
          {records.filter((r) => r.expiringDocs.length > 0).map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800/40 dark:bg-amber-950/20">
              <Bell className="h-4 w-4 flex-shrink-0 text-amber-600" />
              <span className="font-semibold text-amber-800 dark:text-amber-400">{r.staffName}</span>
              <span className="text-amber-700 dark:text-amber-500">— expiring soon: {r.expiringDocs.join(", ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : records.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <Users className="h-8 w-8" />
          <p className="text-sm">No staff compliance records yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const isOpen = expanded === record.id;
            const docs = editingDocs[record.id] ?? record.documents;
            return (
              <div
                key={record.id}
                className={`rounded-xl border bg-white shadow-sm dark:bg-white/5 ${record.missingCount > 0 || record.expiringDocs.length > 0 ? "border-amber-200 dark:border-amber-800/40" : "border-gray-200 dark:border-white/10"}`}
              >
                {/* Row header */}
                <button
                  className="flex w-full items-center gap-4 px-4 py-3 text-left"
                  onClick={() => toggleExpand(record.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{record.staffName}</p>
                      <span className="text-xs text-gray-400">{record.staffRole}</span>
                      {record.missingCount > 0 && (
                        <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> {record.missingCount} missing
                        </span>
                      )}
                      {record.expiringDocs.length > 0 && (
                        <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          <Bell className="h-2.5 w-2.5" /> expiring
                        </span>
                      )}
                      {record.missingCount === 0 && record.expiringDocs.length === 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" /> Compliant
                        </span>
                      )}
                    </div>
                    {record.email && <p className="text-xs text-gray-400 mt-0.5">{record.email}</p>}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />}
                </button>

                {/* Expanded docs */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 dark:border-white/10">
                    <div className="space-y-2">
                      {DOC_TYPES.map((docType) => {
                        const existing = docs.find((d) => d.docType === docType);
                        const status = existing?.status ?? "Missing";
                        return (
                          <div key={docType} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-white/10">
                            <span className="flex-1 min-w-[140px] text-sm text-gray-700 dark:text-gray-300">{docType}</span>
                            {readOnly ? (
                              <span className={`text-xs font-semibold ${statusColor[status] ?? ""}`}>{status}</span>
                            ) : (
                              <>
                                <select
                                  value={status}
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
                                  className={`h-7 rounded border border-gray-200 bg-white px-2 text-xs font-semibold dark:border-white/10 dark:bg-white/5 ${statusColor[status] ?? ""}`}
                                >
                                  {DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}
                                </select>
                                <input
                                  type="date"
                                  value={existing?.expiryDate ?? ""}
                                  placeholder="Expiry"
                                  title="Expiry date"
                                  onChange={(e) => {
                                    setEditingDocs((prev) => {
                                      const list = [...(prev[record.id] ?? record.documents)];
                                      const idx = list.findIndex((d) => d.docType === docType);
                                      if (idx >= 0) {
                                        list[idx] = { ...list[idx], expiryDate: e.target.value };
                                      } else {
                                        list.push({ ...emptyDoc(), docType, expiryDate: e.target.value });
                                      }
                                      return { ...prev, [record.id]: list };
                                    });
                                  }}
                                  className="h-7 rounded border border-gray-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {!readOnly && (
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => saveDocs(record.id)}
                          disabled={!!saving}
                          className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60"
                        >
                          {saving === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Save Documents
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add drawer */}
      {addDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setAddDrawer(false)} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">Add Staff Member</h2>
              <button onClick={() => setAddDrawer(false)} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={addRecord} className="flex-1 overflow-y-auto space-y-4 p-5">
              {addError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{addError}</p>
              )}
              {[
                { label: "Full Name *", key: "staffName", placeholder: "e.g. Ahmed Al Rashidi" },
                { label: "Role *", key: "staffRole", placeholder: "e.g. Assessor" },
                { label: "Email", key: "email", placeholder: "optional" },
                { label: "Phone", key: "phone", placeholder: "optional" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</label>
                  <input
                    required={label.includes("*")}
                    value={(addForm as any)[key]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
              ))}
              <button
                type="submit" disabled={addSaving}
                className="w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60"
              >
                {addSaving ? "Saving…" : "Add Staff Member"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
