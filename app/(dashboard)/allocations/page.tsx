"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Plus, UserCog } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  TableShell,
  Table,
  THead,
  Th,
  Tr,
  Td,
  TableFooter,
  usePagination,
  Pagination,
} from "@/components/ui/table";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";

type AllocationRow = {
  _id: string;
  leadId?: { studentName?: string; studentPhone?: string };
  teacherId?: { fullName?: string };
  backupTeacherId?: { fullName?: string };
  status: string;
  allocatedBy?: { name?: string };
  allocationDate?: string;
};

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/allocations?${params}`);
      const d = await res.json();
      if (res.status === 501) {
        // Module intentionally not implemented on the server yet.
        setAllocations([]);
      } else {
        setAllocations(d.allocations || []);
      }
    } catch {
      setLoadError("Couldn't load allocations. Check your connection and retry.");
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

  const { slice, page, pages, setPage, total } = usePagination(allocations);

  return (
    <div>
      <PageHeader
        title="Teacher Allocations"
        subtitle="Manual teacher-to-lead assignments"
        actions={
          <Link href="/allocations/new" className={cn(buttonVariants({ variant: "secondary" }))}>
            <Plus className="h-4 w-4" aria-hidden /> New Allocation
          </Link>
        }
      />

      <div role="status" className="mb-4 rounded-card border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-4 py-3">
        <p className="text-sm font-bold text-advisory">This module is not yet available.</p>
        <p className="mt-0.5 text-xs text-dim">
          Teacher allocation is planned for a later release. Nothing recorded here yet.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void fetchAllocations()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={5} cols={5} />
          ) : allocations.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="Not yet available"
              description="Allocations will appear here once the module ships. No action is needed."
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th>Lead</Th>
                    <Th>Teacher</Th>
                    <Th className="hidden md:table-cell">Backup</Th>
                    <Th>Status</Th>
                    <Th className="hidden lg:table-cell">Allocated By</Th>
                    <Th className="hidden lg:table-cell">Date</Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((a) => (
                    <Tr key={a._id}>
                      <Td>
                        <p className="font-semibold">{a.leadId?.studentName}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-faint">
                          <Phone className="h-3 w-3" aria-hidden />
                          <span className="readout" data-numeric>{a.leadId?.studentPhone}</span>
                        </p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-bezel bg-well text-[10px] font-bold text-dim"
                          >
                            {a.teacherId?.fullName ? getInitials(a.teacherId.fullName) : "—"}
                          </span>
                          <span className="font-medium">{a.teacherId?.fullName}</span>
                        </div>
                      </Td>
                      <Td className="hidden text-xs text-dim md:table-cell">
                        {a.backupTeacherId?.fullName || "—"}
                      </Td>
                      <Td><StatusBadge status={a.status} /></Td>
                      <Td className="hidden text-xs text-dim lg:table-cell">
                        {a.allocatedBy?.name || "—"}
                      </Td>
                      <Td className="hidden text-xs text-dim lg:table-cell">
                        {a.allocationDate ? formatDate(a.allocationDate) : "—"}
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
