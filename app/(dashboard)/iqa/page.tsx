"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface IQASample {
  id: string;
  learnerProfileId: string;
  unitCode: string;
  sampledBy: string;
  sampledAt: string;
  status: string;
  outcome: string | null;
  feedback: string;
  actionRequired: string;
  actionDueDate: string;
  actionCompleted: boolean;
}

const statusBadge: Record<string, string> = {
  Planned:          "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "In Progress":    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Completed:        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Action Required":"bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const outcomeBadge: Record<string, string> = {
  Confirmed:             "text-green-600 dark:text-green-400",
  "Action Required":     "text-red-600 dark:text-red-400",
  "Referral Upheld":     "text-amber-600 dark:text-amber-400",
  "Referral Overturned": "text-blue-600 dark:text-blue-400",
};

const STATUS_OPTIONS = ["Planned", "In Progress", "Completed", "Action Required"];

export default function IQAPage() {
  const [samples, setSamples] = useState<IQASample[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<IQASample | null>(null);
  const [savingId, setSavingId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/iqa-samples?${params}`)
      .then((r) => r.json())
      .then((d) => setSamples(d.samples ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(load, [load]);

  const save = async (sample: IQASample, patch: Partial<IQASample>) => {
    setSavingId(sample.id);
    try {
      const res = await fetch(`/api/iqa-samples/${sample.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setSamples((prev) => prev.map((s) => (s.id === sample.id ? d.sample : s)));
      setEditing(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingId("");
    }
  };

  const actionRequired = samples.filter((s) => s.status === "Action Required" && !s.actionCompleted);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">IQA Sampling</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Internal Quality Assurance · {samples.length} sample{samples.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={load}
          className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Action required alert */}
      {actionRequired.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {actionRequired.length} IQA sample{actionRequired.length !== 1 ? "s" : ""} need action
        </div>
      )}

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {["", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              statusFilter === s
                ? "bg-[#2E7D32] text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : samples.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <ClipboardList className="h-8 w-8" />
          <p className="text-sm">No IQA samples recorded.</p>
          <p className="text-xs text-gray-300">Samples are created from assessment records.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 sm:table-cell">Outcome</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 md:table-cell">Sampled By</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 md:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {samples.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.unitCode}</p>
                      {s.actionRequired && !s.actionCompleted && (
                        <p className="text-xs text-red-500 line-clamp-1">{s.actionRequired}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing?.id === s.id ? (
                        <select
                          value={editing.status}
                          onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                        >
                          {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge[s.status] ?? ""}`}>
                          {s.status}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {editing?.id === s.id ? (
                        <select
                          value={editing.outcome ?? ""}
                          onChange={(e) => setEditing({ ...editing, outcome: e.target.value || null })}
                          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                        >
                          <option value="">— Select —</option>
                          <option>Confirmed</option>
                          <option>Action Required</option>
                          <option>Referral Upheld</option>
                          <option>Referral Overturned</option>
                        </select>
                      ) : s.outcome ? (
                        <span className={`text-xs font-semibold ${outcomeBadge[s.outcome] ?? ""}`}>
                          {s.outcome}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="text-xs text-gray-500">{s.sampledBy}</span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="text-xs text-gray-500">{s.sampledAt}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editing?.id === s.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => save(s, { status: editing.status, outcome: editing.outcome })}
                            disabled={!!savingId}
                            className="rounded-lg bg-[#2E7D32] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </button>
                          <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:text-gray-700">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setEditing({ ...s })}
                            className="text-xs font-semibold text-[#2E7D32] hover:underline dark:text-green-400"
                          >
                            Update
                          </button>
                          <Link
                            href={`/learner-profiles/${s.learnerProfileId}`}
                            className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-700"
                          >
                            Profile <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 dark:border-white/10">
            {samples.length} record{samples.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
