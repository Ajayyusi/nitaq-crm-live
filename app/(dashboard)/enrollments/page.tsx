"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    const res = await fetch(`/api/enrollments?${params}`);
    const d = await res.json();
    setEnrollments(d.enrollments || []);
    setPagination(d.pagination || {});
    setLoading(false);
  }, [page, status]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Enrollments"
        subtitle={`${pagination.total} total enrollments`}
        actions={
          <Link href="/enrollments/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> New Enrollment
          </Link>
        }
      />

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No enrollments yet"
            description="Create an enrollment to track student sessions and payments."
            action={<Link href="/enrollments/new" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">New Enrollment</Link>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Course</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Teacher</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sessions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((e) => (
                <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{e.studentId?.fullName}</p>
                    <p className="text-xs text-slate-400">{e.studentId?.phone}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-slate-700">{e.courseId?.name}</p>
                    {e.subjectId && <p className="text-xs text-slate-400">{e.subjectId.name}</p>}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-slate-600">
                    {e.teacherId?.fullName || "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-medium text-slate-700">{e.sessionsCount}</span>
                    <span className="text-xs text-slate-400 ml-1">× {e.sessionDuration}min</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-700">{formatCurrency(e.finalPrice)}</p>
                    {e.discount > 0 && <p className="text-xs text-green-600">-{formatCurrency(e.discount)}</p>}
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-4 hidden lg:table-cell text-xs text-slate-400">
                    {e.startDate ? formatDate(e.startDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
