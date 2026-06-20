"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

interface Profile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  riskStatus: "Low" | "Medium" | "High";
  docCompletionPct: number;
  missingRequiredDocs: string[];
  isActive: boolean;
  updatedAt: string;
}

const riskBadge = {
  Low:    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  High:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function LearnerProfilesPage() {
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ active: "true" });
    if (riskFilter) params.set("risk", riskFilter);
    if (search) params.set("search", search);
    fetch(`/api/learner-profiles?${params}`)
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [riskFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Learner Profiles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Compliance records for enrolled learners</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {!readOnly && (
            <Link
              href="/learner-profiles/new"
              className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1B5E20]"
            >
              <Plus className="h-4 w-4" /> Add Profile
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, Emirates ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none ring-[#2E7D32] focus:ring-2 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-500"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none ring-[#2E7D32] focus:ring-2 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">All Risk Levels</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-center text-gray-400 dark:border-white/10">
          <Users className="h-8 w-8" />
          <p className="text-sm">No learner profiles found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Learner</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Risk</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:table-cell">Doc Completion</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 md:table-cell">Missing</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{p.fullName}</p>
                      <p className="text-xs text-gray-400">{p.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${riskBadge[p.riskStatus]}`}>
                        {p.riskStatus === "High" && <ShieldAlert className="h-3 w-3" />}
                        {p.riskStatus}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full ${p.docCompletionPct === 100 ? "bg-green-500" : p.docCompletionPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${p.docCompletionPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{p.docCompletionPct}%</span>
                        {p.docCompletionPct === 100 && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {p.missingRequiredDocs.length === 0 ? (
                        <span className="text-xs text-green-600 dark:text-green-400">All present</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {p.missingRequiredDocs.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/learner-profiles/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D32] hover:underline dark:text-green-400"
                      >
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 dark:border-white/10">
            {profiles.length} profile{profiles.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
