"use client";

import { useEffect, useState, useCallback } from "react";
import { Award, GraduationCap, History, MessageCircle } from "lucide-react";
import HoursProgress from "@/components/shared/HoursProgress";
import ClassHistoryDrawer, { type RegistrationInfo } from "@/components/shared/ClassHistoryDrawer";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { SearchInput, Select } from "@/components/ui/input";
import {
  Pagination, Table, TableFooter, TableShell, Td, Th, THead, Tr, usePagination,
} from "@/components/ui/table";
import { LoadError, SkeletonRows, Spinner } from "@/components/ui/feedback";

type Enrollment = {
  teacherId: string; teacherName: string;
  totalRegisteredHours: number; completedHours: number; remainingHours: number;
  registrationComplete: boolean; missingFields: string[];
  id: string; enrollmentId: string; fullName: string; phone: string;
  course: string; batchName: string; status: string; paymentStatus: string;
  totalFee: number; amountPaid: number; balanceDue: number;
  startDate: string; endDate: string; format: string; email: string;
};

const STATUSES = ["Active", "Completed", "On Hold", "Dropped"] as const;

const PAY_LAMP: Record<string, LampVariant> = {
  "Paid Full": "ok",
  "Instalment 1 Paid": "advisory",
  "Instalment 2 Pending": "caution",
  Overdue: "alert",
  Free: "advisory",
};

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function StatusCell({ enrollment, onUpdated }: { enrollment: Enrollment; onUpdated: (id: string, status: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(newStatus: string) {
    if (newStatus === enrollment.status) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/enrollments/${enrollment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onUpdated(enrollment.id, newStatus);
      else setFailed(true);
    } catch { setFailed(true); }
    finally { setSaving(false); }
  }

  if (saving) return <Spinner className="h-4 w-4" />;

  return (
    <div>
      <Select
        value={enrollment.status}
        onChange={(e) => void change(e.target.value)}
        aria-label={`Status for ${enrollment.fullName}`}
        className="h-8 w-auto pr-7 text-xs"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      {failed && (
        <p role="alert" className="mt-1 text-[11px] font-semibold text-alert">
          Update failed — try again
        </p>
      )}
    </div>
  );
}

export default function StudentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [historyReg, setHistoryReg] = useState<RegistrationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fetchError, setFetchError] = useState("");

  // Debounce search — it drives a fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/enrollments?${params}`);
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setFetchError("Couldn't load students. Check your connection and try again.");
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => { void fetchEnrollments(); }, [fetchEnrollments]);

  function handleStatusUpdate(id: string, newStatus: string) {
    setEnrollments((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: newStatus } : e)
    );
  }

  const eligible = enrollments.filter(
    (e) => e.status === "Completed" && e.balanceDue === 0
  );

  const tabs = ["Active", "Completed", "On Hold", "Dropped", "All"];
  const { slice, page, pages, setPage, total } = usePagination(enrollments, 50);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        subtitle="Enrolled students across all courses"
      />

      {eligible.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-card border border-phos/30 bg-[var(--lamp-ok-bg)] p-3">
          <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-phos" aria-hidden />
          <div className="text-sm text-ink">
            <span className="font-semibold">{eligible.length} student{eligible.length > 1 ? "s" : ""} eligible for certificate:</span>{" "}
            {eligible.slice(0, 4).map((e) => e.fullName).join(", ")}
            {eligible.length > 4 && ` +${eligible.length - 4} more`}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStatusFilter(t)}
              aria-pressed={statusFilter === t}
              className={`h-8 rounded-ctl border px-3 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                statusFilter === t
                  ? "border-transparent bg-phos text-phos-ink shadow-glow"
                  : "border-bezel-strong bg-transparent text-dim hover:bg-well hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, enrollment ID…"
          aria-label="Search students"
          className="min-w-56 flex-1"
        />
      </div>

      {fetchError ? (
        <LoadError message={fetchError} onRetry={() => void fetchEnrollments()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={8} cols={6} />
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students found"
              description="Students appear here once they are enrolled in a course."
            />
          ) : (
            <>
              <Table className="min-w-[760px]">
                <THead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Name</Th>
                    <Th>Course</Th>
                    <Th>Teacher & Hours</Th>
                    <Th>Status</Th>
                    <Th>Payment</Th>
                    <Th numeric>Balance</Th>
                    <Th>Contact</Th>
                    <Th className="text-right"><span className="sr-only">Actions</span></Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((e) => {
                    const certEligible = e.status === "Completed" && e.balanceDue === 0;
                    return (
                      <Tr key={e.id}>
                        <Td className="readout text-xs text-faint" data-numeric>{e.enrollmentId}</Td>
                        <Td>
                          <div className="flex items-center gap-1.5 font-semibold text-ink">
                            {e.fullName}
                            {certEligible && (
                              <Award className="h-3.5 w-3.5 text-caution" aria-label="Certificate eligible" />
                            )}
                            {!e.registrationComplete && (
                              <Lamp variant="alert" title={`Missing: ${e.missingFields.join(", ")}`}>
                                Incomplete
                              </Lamp>
                            )}
                          </div>
                          {e.email && <div className="text-xs text-faint">{e.email}</div>}
                        </Td>
                        <Td>
                          <div className="max-w-40 truncate text-dim" title={e.course}>{e.course}</div>
                          {e.batchName && <div className="text-xs text-faint">{e.batchName}</div>}
                        </Td>
                        <Td>
                          <div className="mb-1 text-xs text-dim">
                            {e.teacherName || <span className="font-medium text-alert">No teacher</span>}
                          </div>
                          <HoursProgress total={e.totalRegisteredHours} completed={e.completedHours} compact />
                        </Td>
                        <Td>
                          <StatusCell enrollment={e} onUpdated={handleStatusUpdate} />
                        </Td>
                        <Td>
                          <Lamp variant={PAY_LAMP[e.paymentStatus] ?? "off"}>{e.paymentStatus}</Lamp>
                          <div className="readout mt-1 text-xs text-faint" data-numeric>Paid: {fmt(e.amountPaid)}</div>
                        </Td>
                        <Td numeric>
                          {e.balanceDue > 0 ? (
                            <span className="font-semibold text-alert">{fmt(e.balanceDue)}</span>
                          ) : (
                            <span className="text-xs font-medium text-phos">Cleared</span>
                          )}
                        </Td>
                        <Td className="readout text-xs text-dim" data-numeric>{e.phone}</Td>
                        <Td>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="iconSm"
                              onClick={() => setHistoryReg({
                                id: e.id, fullName: e.fullName, course: e.course, teacherName: e.teacherName,
                                totalRegisteredHours: e.totalRegisteredHours, completedHours: e.completedHours, remainingHours: e.remainingHours,
                              })}
                              aria-label={`Class history for ${e.fullName}`}
                              title="Class history / record class"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {e.phone && (
                              <a
                                href={(buildWhatsAppUrl(e.phone) ?? "#")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="grid h-8 w-8 place-items-center rounded-ctl text-dim transition-colors hover:bg-well hover:text-phos"
                                aria-label={`WhatsApp ${e.fullName}`}
                                title="WhatsApp"
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                              </a>
                            )}
                          </div>
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

      {historyReg && (
        <ClassHistoryDrawer
          registration={historyReg}
          canManage
          onClose={() => setHistoryReg(null)}
          onHoursChanged={() => void fetchEnrollments()}
        />
      )}
    </div>
  );
}
