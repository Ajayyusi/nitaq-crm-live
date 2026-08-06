"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";
import { TableFooter, Pagination, usePagination } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

const ENTITY_LAMP: Record<string, LampVariant> = {
  Lead: "advisory",
  FollowUp: "caution",
  Enrollment: "ok",
  Payment: "ok",
};

const ACTION_TONE: Record<string, string> = {
  created: "text-phos",
  updated: "text-dim",
  deleted: "text-alert",
  status_changed: "text-advisory",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
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
  const [error, setError] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (entityFilter !== "all") params.set("entity", entityFilter);
      if (userFilter) params.set("user", userFilter);
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      const fetched: LogEntry[] = data.logs ?? [];
      setLogs(fetched);
      // Build unique user list from logs for filter dropdown
      setUsers((prev) => {
        const names = new Set([...prev, ...fetched.map((l) => l.userName)]);
        return Array.from(names).sort();
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, userFilter]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const { slice, page, pages, setPage, total } = usePagination(logs, 50);

  const entities = ["all", "Lead", "FollowUp", "Enrollment", "Payment"];

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Every create, edit, and change across the team"
        actions={
          <Button variant="secondary" size="sm" onClick={() => void fetchLogs()} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by entity">
          {entities.map((e) => (
            <button
              key={e}
              onClick={() => { setEntityFilter(e); setPage(0); }}
              aria-pressed={entityFilter === e}
              className={cn(
                "h-8 rounded-ctl border px-3 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
                entityFilter === e
                  ? "border-phos bg-phos text-phos-ink"
                  : "border-bezel-strong text-dim hover:bg-well hover:text-ink"
              )}
            >
              {e === "all" ? "All" : e === "FollowUp" ? "Follow-Up" : e}
            </button>
          ))}
        </div>

        {users.length > 0 && (
          <Select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(0); }}
            aria-label="Filter by team member"
            className="ml-auto w-auto min-w-44"
          >
            <option value="">All team members</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        )}
      </div>

      {/* Log list */}
      {loading ? (
        <div className="face">
          <SkeletonRows rows={8} cols={4} />
        </div>
      ) : error ? (
        <LoadError
          message="Couldn't load the activity log."
          onRetry={() => void fetchLogs()}
        />
      ) : logs.length === 0 ? (
        <div className="face">
          <EmptyState
            icon={Activity}
            title="No Activity Recorded"
            description="Actions will appear here as your team uses the system."
          />
        </div>
      ) : (
        <div className="face overflow-hidden">
          <ul className="divide-y divide-bezel/60">
            {slice.map((log) => (
              <li key={log._id} className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-well sm:px-5">
                {/* Avatar */}
                <div
                  aria-hidden
                  className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-bezel bg-well text-xs font-bold text-dim"
                >
                  {log.userName.charAt(0).toUpperCase()}
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-ink">{log.userName}</span>
                    <span className="text-xs text-faint">{roleLabels[log.userRole] ?? log.userRole}</span>
                    <span className={cn("readout text-xs font-semibold", ACTION_TONE[log.action] ?? "text-dim")}>
                      {log.action}
                    </span>
                    <Lamp variant={ENTITY_LAMP[log.entity] ?? "off"}>
                      {log.entity === "FollowUp" ? "Follow-Up" : log.entity}
                    </Lamp>
                    <span className="truncate text-sm text-ink">{log.entityLabel}</span>
                  </div>
                  {log.detail && <p className="mt-0.5 text-xs text-dim">{log.detail}</p>}
                </div>

                {/* Time */}
                <div className="flex-shrink-0 text-right">
                  <span
                    className="readout whitespace-nowrap text-xs text-faint"
                    title={fullTime(log.createdAt)}
                    data-numeric
                  >
                    {timeAgo(log.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <TableFooter>
            <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
          </TableFooter>
        </div>
      )}
    </div>
  );
}
