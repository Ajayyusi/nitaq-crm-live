"use client";

import { useEffect, useState, useCallback } from "react";
import { GraduationCap, Award, MessageCircle, Search } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

type Enrollment = {
  id: string; enrollmentId: string; fullName: string; phone: string;
  course: string; batchName: string; status: string; paymentStatus: string;
  totalFee: number; amountPaid: number; balanceDue: number;
  startDate: string; endDate: string; format: string; email: string;
};

const statusColor: Record<string, string> = {
  Active: "bg-[#E8F5E9] text-[#1B5E20]",
  Completed: "bg-teal-50 text-teal-700",
  Dropped: "bg-red-50 text-red-700",
  "On Hold": "bg-amber-50 text-amber-700",
};

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function StudentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [search, setSearch] = useState("");
  const [fetchError, setFetchError] = useState("");

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/enrollments?${params}`);
      const data = await res.json();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setFetchError("Could not load students. Please check your connection and try again.");
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  // A student is certificate-eligible when they have no balance due
  // (attendance >= 80% check will come once attendance module populates data)
  const eligible = enrollments.filter(
    (e) => e.status === "Completed" && e.balanceDue === 0
  );

  const tabs = ["Active", "Completed", "On Hold", "Dropped", "All"];

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Students"
        subtitle="Enrolled students across all courses"
      />

      {/* Certificate eligibility banner */}
      {eligible.length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-xl flex items-start gap-3">
          <Award className="w-4 h-4 text-[#2E7D32] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[#1B5E20]">
            <span className="font-semibold">{eligible.length} student{eligible.length > 1 ? "s" : ""} eligible for certificate:</span>{" "}
            {eligible.slice(0, 4).map((e) => e.fullName).join(", ")}
            {eligible.length > 4 && ` +${eligible.length - 4} more`}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="px-6 pt-4 pb-2 flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setStatusFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              statusFilter === t
                ? "bg-[#2E7D32] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-[#2E7D32] hover:text-[#2E7D32]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, phone, enrollment ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
          />
        </div>
      </div>

      {fetchError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 px-6 pb-8 overflow-auto">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="Students appear here once they are enrolled in a course."
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["ID", "Name", "Course", "Status", "Payment", "Balance", "Contact", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.map((e) => {
                  const certEligible = e.status === "Completed" && e.balanceDue === 0;
                  return (
                    <tr key={e.id} className="hover:bg-[#E8F5E9]/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{e.enrollmentId}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] font-bold text-xs flex-shrink-0">
                            {e.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-[#0D1F0E] flex items-center gap-1">
                              {e.fullName}
                              {certEligible && (
                                <Award className="w-3.5 h-3.5 text-amber-500" aria-label="Certificate eligible" />
                              )}
                            </div>
                            {e.email && <div className="text-xs text-slate-400">{e.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 max-w-[160px] truncate">{e.course}</div>
                        {e.batchName && <div className="text-xs text-slate-400">{e.batchName}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[e.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-600">{e.paymentStatus}</div>
                        <div className="text-xs text-slate-400">Paid: {fmt(e.amountPaid)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {e.balanceDue > 0 ? (
                          <span className="text-red-700 font-semibold text-sm">{fmt(e.balanceDue)}</span>
                        ) : (
                          <span className="text-[#2E7D32] text-xs font-medium">Cleared</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-600 text-xs">{e.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        {e.phone && (
                          <a
                            href={`https://wa.me/${e.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-[#25D366] hover:bg-green-50 rounded transition inline-flex"
                            title="WhatsApp"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
