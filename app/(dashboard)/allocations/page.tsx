"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, UserCog, Phone } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/allocations?${params}`);
      const d = await res.json();
      if (res.status === 501) {
        setAllocations([]);
      } else {
        setAllocations(d.allocations || []);
      }
    } catch {
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Teacher Allocations"
        subtitle="Manual teacher-to-lead assignments"
        actions={
          <Link href="/allocations/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> New Allocation
          </Link>
        }
      />

      <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm font-semibold text-amber-800">This module is not implemented yet.</p>
        <p className="text-xs text-amber-600 mt-0.5">Teacher allocation management will be available in a future update.</p>
      </div>

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : allocations.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No allocations yet"
            description="Start by allocating a teacher to a lead."
            action={
              <Link href="/allocations/new" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">
                Create First Allocation
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Teacher</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Backup</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Allocated By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations.map((a) => (
                <tr key={a._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{a.leadId?.studentName}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Phone className="w-3 h-3" />{a.leadId?.studentPhone}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                        {a.teacherId?.fullName?.[0]}
                      </div>
                      <span className="text-slate-700 font-medium">{a.teacherId?.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-slate-500 text-xs">
                    {a.backupTeacherId?.fullName || "—"}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-slate-500 text-xs">
                    {a.allocatedBy?.name || "—"}
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-slate-500 text-xs">
                    {formatDate(a.allocationDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
