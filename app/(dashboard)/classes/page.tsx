"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Calendar, Clock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dateFilter) params.set("date", dateFilter);
    const res = await fetch(`/api/classes?${params}`);
    const d = await res.json();
    setClasses(d.classes || []);
    setLoading(false);
  }, [status, dateFilter]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  async function updateStatus(classId: string, newStatus: string) {
    await fetch(`/api/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchClasses();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Classes & Sessions"
        subtitle="Scheduled class sessions"
        actions={
          <Link href="/classes/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Schedule Class
          </Link>
        }
      />

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} className="text-sm text-slate-500 hover:text-slate-700">Clear date</button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : classes.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No classes found"
            description="Schedule classes from enrollments."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Teacher</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Mode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{formatDate(c.classDate)}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {c.startTime} – {c.endTime}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{c.studentId?.fullName || "—"}</td>
                  <td className="px-4 py-4 text-slate-700 hidden md:table-cell">{c.teacherId?.fullName || "—"}</td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.mode === "online" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {c.mode}
                    </span>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-4">
                    {c.status === "scheduled" && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(c._id, "completed")} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition">Done</button>
                        <button onClick={() => updateStatus(c._id, "cancelled")} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">Cancel</button>
                      </div>
                    )}
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
