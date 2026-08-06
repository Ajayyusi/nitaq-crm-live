"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Select } from "@/components/ui/input";
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
import { LoadError, SkeletonRows, Spinner } from "@/components/ui/feedback";

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

const STATUS_LAMP: Record<string, LampVariant> = {
  Planned: "advisory",
  "In Progress": "caution",
  Completed: "ok",
  "Action Required": "alert",
};

const OUTCOME_LAMP: Record<string, LampVariant> = {
  Confirmed: "ok",
  "Action Required": "alert",
  "Referral Upheld": "caution",
  "Referral Overturned": "advisory",
};

const STATUS_OPTIONS = ["Planned", "In Progress", "Completed", "Action Required"];

export default function IQAPage() {
  const [samples, setSamples] = useState<IQASample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<IQASample | null>(null);
  const [savingId, setSavingId] = useState("");
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/iqa-samples?${params}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSamples(d.samples ?? []);
    } catch {
      setError("Couldn't load IQA samples. Check your connection and retry.");
      setSamples([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (sample: IQASample, patch: Partial<IQASample>) => {
    setSavingId(sample.id);
    setSaveError("");
    try {
      const res = await fetch(`/api/iqa-samples/${sample.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't save the sample — try again.");
      setSamples((prev) => prev.map((s) => (s.id === sample.id ? d.sample : s)));
      setEditing(null);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSavingId("");
    }
  };

  const actionRequired = samples.filter((s) => s.status === "Action Required" && !s.actionCompleted);
  const { slice, page, pages, setPage, total } = usePagination(samples, 50);

  return (
    <div className="space-y-4">
      <PageHeader
        title="IQA Sampling"
        subtitle={`Internal Quality Assurance · ${samples.length} sample${samples.length !== 1 ? "s" : ""}`}
        actions={
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh IQA samples"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        }
      />

      {/* Action required notice */}
      {actionRequired.length > 0 && !error && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />
          {actionRequired.length} IQA sample{actionRequired.length !== 1 ? "s" : ""} need action
        </div>
      )}

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

      {saveError && (
        <div
          role="alert"
          className="rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert"
        >
          {saveError}
        </div>
      )}

      {error ? (
        <LoadError message={error} onRetry={() => void load()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={8} cols={6} />
          ) : samples.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No IQA samples recorded"
              description={
                statusFilter
                  ? "No samples match this status filter."
                  : "Samples are created from assessment records."
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
              <Table className="min-w-[680px]">
                <THead>
                  <tr>
                    <Th>Unit</Th>
                    <Th>Status</Th>
                    <Th className="hidden sm:table-cell">Outcome</Th>
                    <Th className="hidden md:table-cell">Sampled By</Th>
                    <Th className="hidden md:table-cell">Date</Th>
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((s) => (
                    <Tr key={s.id}>
                      <Td>
                        <p className="text-sm font-semibold text-ink">{s.unitCode}</p>
                        {s.actionRequired && !s.actionCompleted && (
                          <p className="line-clamp-1 text-xs text-alert" title={s.actionRequired}>
                            {s.actionRequired}
                          </p>
                        )}
                      </Td>
                      <Td>
                        {editing?.id === s.id ? (
                          <Select
                            value={editing.status}
                            onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                            aria-label={`Status for ${s.unitCode}`}
                            className="h-8 w-auto pr-7 text-xs"
                          >
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </Select>
                        ) : (
                          <Lamp variant={STATUS_LAMP[s.status] ?? "off"}>{s.status}</Lamp>
                        )}
                      </Td>
                      <Td className="hidden sm:table-cell">
                        {editing?.id === s.id ? (
                          <Select
                            value={editing.outcome ?? ""}
                            onChange={(e) => setEditing({ ...editing, outcome: e.target.value || null })}
                            aria-label={`Outcome for ${s.unitCode}`}
                            className="h-8 w-auto pr-7 text-xs"
                          >
                            <option value="">— Select —</option>
                            <option>Confirmed</option>
                            <option>Action Required</option>
                            <option>Referral Upheld</option>
                            <option>Referral Overturned</option>
                          </Select>
                        ) : s.outcome ? (
                          <Lamp variant={OUTCOME_LAMP[s.outcome] ?? "off"}>{s.outcome}</Lamp>
                        ) : (
                          <span className="text-xs text-faint">—</span>
                        )}
                      </Td>
                      <Td className="hidden md:table-cell">
                        <span className="text-xs text-dim">{s.sampledBy}</span>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <span className="readout text-xs text-dim" data-numeric>
                          {s.sampledAt}
                        </span>
                      </Td>
                      <Td className="text-right">
                        {editing?.id === s.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void save(s, { status: editing.status, outcome: editing.outcome })}
                              disabled={!!savingId}
                            >
                              {savingId === s.id ? <Spinner className="h-3 w-3" /> : "Save"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditing({ ...s })}>
                              Update
                            </Button>
                            <Link
                              href={`/learner-profiles/${s.learnerProfileId}`}
                              className="inline-flex items-center gap-0.5 text-xs font-medium text-dim transition-colors hover:text-ink"
                            >
                              Profile <ChevronRight className="h-3 w-3" aria-hidden />
                            </Link>
                          </div>
                        )}
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
    </div>
  );
}
