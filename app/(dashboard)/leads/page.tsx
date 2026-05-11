"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Phone, Calendar, User, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

const STATUSES = ["", "new", "contacted", "trial_booked", "trial_done", "enrolled", "lost", "on_hold"];
const SOURCES = ["", "walk_in", "referral", "instagram", "facebook", "google", "website", "whatsapp", "other"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setPagination(data.pagination || {});
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Leads CRM"
        subtitle={`${pagination.total} total leads`}
        actions={
          <Link
            href="/leads/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </Link>
        }
      />

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1 min-w-48 max-w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
          />
        </div>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace("_", " ") : "All Statuses"}</option>
          ))}
        </select>

        <button onClick={fetchLeads} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No leads found"
            description="Start by adding your first lead or adjust your search filters."
            action={
              <Link href="/leads/new" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                Add First Lead
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Course</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Follow Up</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Assigned To</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{lead.studentName}</p>
                      <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                        <Phone className="w-3 h-3" />
                        {lead.studentPhone}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div>
                      <p className="text-slate-700">{lead.courseId?.name || "—"}</p>
                      {lead.mode && <span className="text-xs text-slate-400 capitalize">{lead.mode}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-slate-500 capitalize">
                    {lead.leadSource?.replace("_", " ") || "—"}
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    {lead.followUpDate ? (
                      <div className="flex items-center gap-1 text-slate-500 text-xs">
                        <Calendar className="w-3 h-3" />
                        {formatDate(lead.followUpDate)}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-4 hidden xl:table-cell">
                    {lead.assignedSalesUser ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                          {lead.assignedSalesUser.name?.[0]}
                        </div>
                        <span className="text-slate-600 text-xs">{lead.assignedSalesUser.name}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/leads/${lead._id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
