"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, ClipboardCheck, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import {
  Pagination,
  Table,
  TableFooter,
  TableShell,
  Td,
  Th,
  THead,
  Tr,
  usePagination,
} from "@/components/ui/table";
import { LoadError, SkeletonRows } from "@/components/ui/feedback";

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

const STATUS_LAMP: Record<string, LampVariant> = {
  "Not Submitted": "off",
  Submitted: "advisory",
  "Under Assessment": "caution",
  Referred: "alert",
  Resubmitted: "advisory",
  Passed: "ok",
};

const STATUS_OPTIONS = ["Not Submitted", "Submitted", "Under Assessment", "Referred", "Resubmitted", "Passed"];

function isOverdue(dueDate: string, status: string) {
  if (!dueDate || status === "Passed") return false;
  return new Date(dueDate) < new Date();
}

export default function AssessmentsPage() {
  const router = useRouter();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/assessments?${params}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setAssessments(d.assessments ?? []);
    } catch {
      setError("Couldn't load assessments. Check your connection and retry.");
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const overdue = assessments.filter((a) => isOverdue(a.dueDate, a.status));
  const active = assessments.filter((a) => !["Passed"].includes(a.status));

  const { slice, page, pages, setPage, total } = usePagination(assessments, 50);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assessments"
        subtitle={`Unit assessment tracker · ${active.length} active${overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}`}
        actions={
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh assessments"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        }
      />

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {["", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
            className={`h-8 rounded-ctl border px-3 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
              statusFilter === s
                ? "border-transparent bg-phos text-phos-ink shadow-glow"
                : "border-bezel-strong bg-transparent text-dim hover:bg-well hover:text-ink"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Overdue notice */}
      {overdue.length > 0 && !statusFilter && !error && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />
          {overdue.length} assessment{overdue.length !== 1 ? "s" : ""} past due date
        </div>
      )}

      {error ? (
        <LoadError message={error} onRetry={() => void load()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={8} cols={5} />
          ) : assessments.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No assessments found"
              description={
                statusFilter
                  ? "No assessments match this status filter."
                  : "Assessments are added from a learner's profile page."
              }
              action={
                statusFilter ? (
                  <Button variant="secondary" size="sm" onClick={() => setStatusFilter("")}>
                    Show All
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Table className="min-w-[560px]">
                <THead>
                  <tr>
                    <Th>Unit</Th>
                    <Th>Status</Th>
                    <Th className="hidden sm:table-cell">Due Date</Th>
                    <Th className="hidden md:table-cell">Grade</Th>
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((a) => {
                    const late = isOverdue(a.dueDate, a.status);
                    return (
                      <Tr
                        key={a.id}
                        clickable
                        onClick={() => router.push(`/learner-profiles/${a.learnerProfileId}`)}
                      >
                        <Td>
                          <p className="text-sm font-semibold text-ink">{a.unitCode}</p>
                          {a.unitTitle && (
                            <p className="line-clamp-1 text-xs text-faint" title={a.unitTitle}>
                              {a.unitTitle}
                            </p>
                          )}
                        </Td>
                        <Td>
                          <Lamp variant={STATUS_LAMP[a.status] ?? "off"}>{a.status}</Lamp>
                        </Td>
                        <Td className="hidden sm:table-cell">
                          {a.dueDate ? (
                            <span
                              className={`readout text-xs ${late ? "font-bold text-alert" : "text-dim"}`}
                              data-numeric
                            >
                              {a.dueDate}
                            </span>
                          ) : (
                            <span className="text-xs text-faint">—</span>
                          )}
                        </Td>
                        <Td className="hidden md:table-cell">
                          <span className="text-xs text-dim">{a.grade || "—"}</span>
                        </Td>
                        <Td className="text-right">
                          <Link
                            href={`/learner-profiles/${a.learnerProfileId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-phos hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Profile <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <TableFooter>
                <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
              </TableFooter>
            </>
          )}
        </TableShell>
      )}
    </div>
  );
}
