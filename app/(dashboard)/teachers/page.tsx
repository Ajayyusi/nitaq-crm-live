"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Phone, Mail, UserCheck, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";

const EMP_TYPES: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", freelance: "Freelance", contract: "Contract",
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/teachers?${params}`);
    const d = await res.json();
    setTeachers(d.teachers || []);
    setLoading(false);
  }, [search, status]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  useEffect(() => {
    const t = setTimeout(() => fetchTeachers(), 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Teachers"
        subtitle={`${teachers.length} teacher${teachers.length !== 1 ? "s" : ""}`}
        actions={
          <Link href="/teachers/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add Teacher
          </Link>
        }
      />

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1 max-w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm placeholder-slate-400 outline-none w-full"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
        </select>
        <button onClick={fetchTeachers} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : teachers.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No teachers found"
            description="Add teachers to start building your team."
            action={<Link href="/teachers/new" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Add First Teacher</Link>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teachers.map((teacher) => (
              <Link
                key={teacher._id}
                href={`/teachers/${teacher._id}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {teacher.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate group-hover:text-blue-700 transition">{teacher.fullName}</h3>
                      <StatusBadge status={teacher.status} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{EMP_TYPES[teacher.employmentType] || teacher.employmentType}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {teacher.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="w-3.5 h-3.5" /> {teacher.phone}
                    </div>
                  )}
                  {teacher.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail className="w-3.5 h-3.5" /> {teacher.email}
                    </div>
                  )}
                </div>

                {teacher.jobTitle && (
                  <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">{teacher.jobTitle}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
