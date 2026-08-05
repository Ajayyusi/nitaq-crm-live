"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, BookOpen, CalendarDays, Clock, GraduationCap,
  History, Loader2, Plus, RefreshCw, Search, Users,
} from "lucide-react";
import HoursProgress from "@/components/shared/HoursProgress";
import ClassHistoryDrawer, { type RegistrationInfo } from "@/components/shared/ClassHistoryDrawer";

interface StudentRow {
  id: string; fullName: string; course: string; teacherName: string;
  totalRegisteredHours: number; completedHours: number; remainingHours: number;
  status: string; startDate: string; expectedCompletionDate: string;
  registrationComplete: boolean; missingFields: string[];
}
interface Stats {
  totalStudents: number; activeCourses: number; classesToday: number;
  classesThisWeek: number; hoursThisMonth: number; lowHoursCount: number;
}
interface RecentSession {
  id: string; studentName: string; course: string; classDate: string;
  deliveredHours: number; classStatus: string;
}

const regBadge: Record<string, string> = {
  Active: "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
  "On Hold": "bg-amber-100 text-amber-700",
  Dropped: "bg-slate-100 text-slate-500",
};

export default function MyStudentsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canManage = role === "admin" || role === "manager";

  const [linked, setLinked] = useState(true);
  const [teacherName, setTeacherName] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<RegistrationInfo | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/my/students")
      .then((r) => r.json())
      .then((d) => {
        setLinked(d.linked !== false);
        setTeacherName(d.teacher?.name ?? "");
        setStudents(d.students ?? []);
        setStats(d.stats ?? null);
        setRecent(d.recentSessions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = students.filter(
    (s) => !search || s.fullName.toLowerCase().includes(search.toLowerCase()) || s.course.toLowerCase().includes(search.toLowerCase())
  );

  const openDrawer = (s: StudentRow) => {
    setDrawer({
      id: s.id, fullName: s.fullName, course: s.course, teacherName: s.teacherName,
      totalRegisteredHours: s.totalRegisteredHours, completedHours: s.completedHours, remainingHours: s.remainingHours,
    });
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>;
  }

  if (!linked) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800/40 dark:bg-amber-950/20">
          <GraduationCap className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-bold text-amber-900 dark:text-amber-300">No teacher profile linked</h1>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-500">
            Your login email doesn&apos;t match any Trainer record. Ask an admin to set your
            email on your Trainer profile (Trainers page) so your students appear here.
          </p>
        </div>
      </div>
    );
  }

  const cards = stats ? [
    { label: "My Students", value: stats.totalStudents, icon: Users, color: "text-blue-600" },
    { label: "Active Courses", value: stats.activeCourses, icon: BookOpen, color: "text-teal-600" },
    { label: "Classes Today", value: stats.classesToday, icon: CalendarDays, color: "text-[#2E7D32]" },
    { label: "Done This Week", value: stats.classesThisWeek, icon: History, color: "text-indigo-600" },
    { label: "Hours This Month", value: `${stats.hoursThisMonth}h`, icon: Clock, color: "text-purple-600" },
    { label: "Low Hours", value: stats.lowHoursCount, icon: AlertTriangle, color: stats.lowHoursCount > 0 ? "text-orange-600" : "text-gray-400" },
  ] : [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Students</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{teacherName} · {students.length} assigned registrations</p>
        </div>
        <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <c.icon className={`mb-1.5 h-4 w-4 ${c.color}`} />
            <p className="text-lg font-extrabold text-gray-900 dark:text-white">{c.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input placeholder="Search student or course…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white" />
      </div>

      {/* Students table */}
      {filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <Users className="h-8 w-8" />
          <p className="text-sm">No students assigned to you yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  {["Student", "Course", "Hours Progress", "Status", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filtered.map((s) => (
                  <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 ${!s.registrationComplete ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{s.fullName}</p>
                      {s.expectedCompletionDate && <p className="text-[11px] text-gray-400">Target: {s.expectedCompletionDate}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{s.course}</td>
                    <td className="px-3 py-2.5"><HoursProgress total={s.totalRegisteredHours} completed={s.completedHours} compact /></td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${regBadge[s.status] ?? "bg-slate-100 text-slate-600"}`}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => openDrawer(s)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1B5E20]">
                        <Plus className="h-3.5 w-3.5" /> Class / History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recently recorded classes */}
      {recent.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Recently Recorded</p>
          <div className="space-y-1.5">
            {recent.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                <span className="font-medium text-gray-900 dark:text-white">{r.studentName}</span>
                <span className="text-xs text-gray-400">{r.course}</span>
                <span className="text-xs text-gray-400">{r.classDate}</span>
                <span className="ml-auto text-xs font-bold tabular-nums text-gray-700 dark:text-gray-300">{r.deliveredHours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {drawer && (
        <ClassHistoryDrawer
          registration={drawer}
          canManage={canManage}
          onClose={() => setDrawer(null)}
          onHoursChanged={load}
        />
      )}
    </div>
  );
}
