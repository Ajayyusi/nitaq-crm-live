"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, Filter, Loader2, RefreshCw, UserCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

type LogEntry = {
  _id: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityLabel: string;
  detail: string;
  createdAt: string;
};

const entityColors: Record<string, string> = {
  Lead:       "bg-sky-100 text-sky-700",
  FollowUp:   "bg-amber-100 text-amber-700",
  Enrollment: "bg-teal-100 text-teal-700",
  Payment:    "bg-emerald-100 text-emerald-700",
};

const actionColors: Record<string, string> = {
  created:        "text-[#2E7D32]",
  updated:        "text-slate-600",
  deleted:        "text-rose-600",
  status_changed: "text-indigo-600",
};

const roleLabels: Record<string, string> = {
  admin:   "Admin",
  manager: "Manager",
  sales:   "Sales",
  finance: "Finance",
  trainer: "Trainer",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fullTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (entityFilter !== "all") params.set("entity", entityFilter);
      if (userFilter) params.set("user", userFilter);
      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      const fetched: LogEntry[] = data.logs ?? [];
      setLogs(fetched);
      // Build unique user list from logs for filter dropdown
      setUsers((prev) => {
        const names = new Set([...prev, ...fetched.map((l) => l.userName)]);
        return Array.from(names).sort();
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [entityFilter, userFilter]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const entities = ["all", "Lead", "FollowUp", "Enrollment", "Payment"];

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Activity Log"
        subtitle="Everything your team does — every edit, creation, and change"
      />

      {/* Filters */}
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {entities.map((e) => (
            <button
              key={e}
              onClick={() => setEntityFilter(e)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                entityFilter === e
                  ? "bg-[#2E7D32] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:text-[#2E7D32]"
              }`}
            >
              {e === "all" ? "All" : e === "FollowUp" ? "Follow-Up" : e}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {users.length > 0 && (
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-slate-700"
              >
                <option value="">All team members</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:border-[#2E7D32] hover:text-[#2E7D32] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="flex-1 px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" />
            <span className="text-sm font-semibold">Loading activity...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Activity className="h-10 w-10" />
            <p className="text-sm font-semibold">No activity yet</p>
            <p className="text-xs">Actions will appear here as your team uses the system</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {logs.map((log) => (
              <div key={log._id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                {/* Avatar */}
                <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] font-bold text-xs">
                  {log.userName.charAt(0).toUpperCase()}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-semibold text-sm text-[#0D1F0E]">{log.userName}</span>
                    <span className="text-xs text-slate-400">{roleLabels[log.userRole] ?? log.userRole}</span>
                    <span className={`text-xs font-semibold ${actionColors[log.action] ?? "text-slate-600"}`}>
                      {log.action}
                    </span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${entityColors[log.entity] ?? "bg-slate-100 text-slate-600"}`}>
                      {log.entity === "FollowUp" ? "Follow-Up" : log.entity}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate">{log.entityLabel}</span>
                  </div>
                  {log.detail && (
                    <p className="mt-0.5 text-xs text-slate-500">{log.detail}</p>
                  )}
                </div>

                {/* Time */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-slate-400 whitespace-nowrap" title={fullTime(log.createdAt)}>
                    {timeAgo(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
