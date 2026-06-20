"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

interface Assessment {
  id: string;
  learnerProfileId: string;
  qualificationId: string;
  unitCode: string;
  unitTitle: string;
  status: string;
  dueDate: string;
  grade: string;
  assessorFeedback: string;
  submittedAt: string;
  markingDeadline: string;
  updatedAt: string;
}

const statusBadge: Record<string, string> = {
  "Not Submitted":   "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
  Submitted:         "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Under Assessment":"bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Referred:          "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Resubmitted:       "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Passed:            "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_OPTIONS = ["Not Submitted", "Submitted", "Under Assessment", "Referred", "Resubmitted", "Passed"];

function isOverdue(dueDate: string, status: string) {
  if (!dueDate || status === "Passed") return false;
  return new Date(dueDate) < new Date();
}

export default function AssessmentsPage() {
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const _readOnly = isReadOnlyRole(role);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/assessments?${params}`)
      .then((r) => r.json())
      .then((d) => setAssessments(d.assessments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(load, [load]);

  const overdue = assessments.filter((a) => isOverdue(a.dueDate, a.status));
  const active = assessments.filter((a) => !["Passed"].includes(a.status));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Assessments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unit assessment tracker · {active.length} active{overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter */}
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

      {/* Overdue alert */}
      {overdue.length > 0 && !statusFilter && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400">
          ⚠ {overdue.length} assessment{overdue.length !== 1 ? "s" : ""} past due date
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : assessments.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <ClipboardCheck className="h-8 w-8" />
          <p className="text-sm">No assessments found.</p>
          <p className="text-xs text-gray-300">Add assessments from a learner's profile page.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 sm:table-cell">Due Date</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 md:table-cell">Grade</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {assessments.map((a) => (
                  <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 ${isOverdue(a.dueDate, a.status) ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{a.unitCode}</p>
                      {a.unitTitle && <p className="text-xs text-gray-400 line-clamp-1">{a.unitTitle}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge[a.status] ?? ""}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {a.dueDate ? (
                        <span className={`text-xs ${isOverdue(a.dueDate, a.status) ? "font-bold text-red-600 dark:text-red-400" : "text-gray-500"}`}>
                          {a.dueDate}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="text-xs text-gray-500">{a.grade || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/learner-profiles/${a.learnerProfileId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D32] hover:underline dark:text-green-400"
                      >
                        Profile <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 dark:border-white/10">
            {assessments.length} record{assessments.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
