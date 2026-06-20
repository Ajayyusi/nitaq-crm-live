"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  BookMarked,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

interface Qualification {
  id: string;
  title: string;
  awardingBody: string;
  level: string;
  qualificationCode: string;
  credits: number | null;
  units: { unitCode: string; unitTitle: string; isMandatory: boolean }[];
  status: string;
  updatedAt: string;
}

const statusBadge: Record<string, string> = {
  Active:           "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Inactive:         "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
  "Pending Approval": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

const AWARDING_BODIES = ["Qualifi", "Pearson", "City & Guilds", "OTHM", "ATHE", "Other"];

interface FormState {
  title: string;
  awardingBody: string;
  level: string;
  qualificationCode: string;
  credits: string;
  glh: string;
  tqt: string;
  status: string;
}

const emptyForm = (): FormState => ({
  title: "", awardingBody: "Qualifi", level: "",
  qualificationCode: "", credits: "", glh: "", tqt: "", status: "Active",
});

export default function QualificationsPage() {
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role) || (role !== "admin" && role !== "manager" && role !== "iqa");

  const [quals, setQuals] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/qualifications")
      .then((r) => r.json())
      .then((d) => setQuals(d.qualifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openDrawer = () => { setForm(emptyForm()); setError(""); setDrawerOpen(true); };
  const closeDrawer = () => setDrawerOpen(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          credits: form.credits ? Number(form.credits) : null,
          glh: form.glh ? Number(form.glh) : null,
          tqt: form.tqt ? Number(form.tqt) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setQuals((prev) => [d.qualification, ...prev]);
      closeDrawer();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Qualifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Qualifi, OTHM and other awarding body qualifications</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {!readOnly && (
            <button
              onClick={openDrawer}
              className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1B5E20]"
            >
              <Plus className="h-4 w-4" /> Add Qualification
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : quals.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <BookMarked className="h-8 w-8" />
          <p className="text-sm">No qualifications yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quals.map((q) => (
            <Link
              key={q.id}
              href={`/qualifications/${q.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug group-hover:text-[#2E7D32] dark:group-hover:text-green-400 line-clamp-2">
                    {q.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{q.awardingBody} · Level {q.level}</p>
                  {q.qualificationCode && (
                    <p className="text-xs text-gray-400">{q.qualificationCode}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-[#2E7D32] dark:group-hover:text-green-400" />
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge[q.status] ?? ""}`}>
                  {q.status}
                </span>
                {q.credits != null && (
                  <span className="text-xs text-gray-400">{q.credits} credits</span>
                )}
                <span className="text-xs text-gray-400">{q.units.length} unit{q.units.length !== 1 ? "s" : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={closeDrawer} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">Add Qualification</h2>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={submit} className="flex-1 overflow-y-auto space-y-4 p-5">
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</p>
              )}
              <Field label="Title *">
                <input
                  required value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Qualifi Level 5 Diploma in Leadership & Management"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Awarding Body">
                  <select value={form.awardingBody} onChange={(e) => setForm((f) => ({ ...f, awardingBody: e.target.value }))} className="input-field">
                    {AWARDING_BODIES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Level *">
                  <input
                    required value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    className="input-field" placeholder="e.g. 5"
                  />
                </Field>
              </div>
              <Field label="Qualification Code">
                <input
                  value={form.qualificationCode}
                  onChange={(e) => setForm((f) => ({ ...f, qualificationCode: e.target.value }))}
                  className="input-field" placeholder="e.g. 603/1234/X"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Credits">
                  <input type="number" min={0} value={form.credits} onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))} className="input-field" />
                </Field>
                <Field label="GLH">
                  <input type="number" min={0} value={form.glh} onChange={(e) => setForm((f) => ({ ...f, glh: e.target.value }))} className="input-field" />
                </Field>
                <Field label="TQT">
                  <input type="number" min={0} value={form.tqt} onChange={(e) => setForm((f) => ({ ...f, tqt: e.target.value }))} className="input-field" />
                </Field>
              </div>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="input-field">
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Pending Approval</option>
                </select>
              </Field>
              <div className="pt-2">
                <button
                  type="submit" disabled={saving}
                  className="w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Create Qualification"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <style>{`.input-field { width:100%; height:2.25rem; border-radius:0.5rem; border:1px solid #e5e7eb; background:white; padding:0 0.75rem; font-size:0.875rem; outline:none; } .input-field:focus { ring:2px solid #2E7D32; } @media (prefers-color-scheme: dark) { .input-field { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: white; } }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}
