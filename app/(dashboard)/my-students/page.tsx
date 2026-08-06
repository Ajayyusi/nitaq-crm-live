"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, BookOpen, CalendarDays, Clock, GraduationCap,
  History, Plus, RefreshCw, Users,
} from "lucide-react";
import HoursProgress from "@/components/shared/HoursProgress";
import ClassHistoryDrawer, { type RegistrationInfo } from "@/components/shared/ClassHistoryDrawer";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Instrument, InstrumentRow } from "@/components/ui/instrument";
import {
  Pagination, Table, TableFooter, TableShell, Td, Th, THead, Tr, usePagination,
} from "@/components/ui/table";
import { LoadError, PanelLoading } from "@/components/ui/feedback";

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<RegistrationInfo | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/my/students")
      .then((r) => r.json())
      .then((d) => {
        setLinked(d.linked !== false);
        setTeacherName(d.teacher?.name ?? "");
        setStudents(d.students ?? []);
        setStats(d.stats ?? null);
        setRecent(d.recentSessions ?? []);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = students.filter(
    (s) => !search || s.fullName.toLowerCase().includes(search.toLowerCase()) || s.course.toLowerCase().includes(search.toLowerCase())
  );
  const { slice, page, pages, setPage, total } = usePagination(filtered, 50);

  const openDrawer = (s: StudentRow) => {
    setDrawer({
      id: s.id, fullName: s.fullName, course: s.course, teacherName: s.teacherName,
      totalRegisteredHours: s.totalRegisteredHours, completedHours: s.completedHours, remainingHours: s.remainingHours,
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Students" />
        <PanelLoading label="Loading your students" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Students" />
        <LoadError message="Couldn't load your students. Check your connection and retry." onRetry={load} />
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Students" />
        <div className="mx-auto max-w-lg rounded-card border border-caution/30 bg-[var(--lamp-caution-bg)] p-6 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-caution" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-ink">No teacher profile linked</h2>
          <p className="mt-1 text-sm text-dim">
            Your login email doesn&apos;t match any Trainer record. Ask an admin to set your
            email on your Trainer profile (Trainers page) so your students appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Students"
        subtitle={`${teacherName} · ${students.length} assigned registrations`}
        actions={
          <Button variant="secondary" size="icon" onClick={load} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {/* Stats */}
      {stats && (
        <InstrumentRow>
          <Instrument label="My Students" value={stats.totalStudents} corner={<Users className="h-4 w-4 text-faint" aria-hidden />} />
          <Instrument label="Active Courses" value={stats.activeCourses} corner={<BookOpen className="h-4 w-4 text-faint" aria-hidden />} />
          <Instrument label="Classes Today" value={stats.classesToday} tone="phos" corner={<CalendarDays className="h-4 w-4 text-faint" aria-hidden />} />
          <Instrument label="Done This Week" value={stats.classesThisWeek} corner={<History className="h-4 w-4 text-faint" aria-hidden />} />
          <Instrument label="Hours This Month" value={`${stats.hoursThisMonth}h`} corner={<Clock className="h-4 w-4 text-faint" aria-hidden />} />
          <Instrument
            label="Low Hours"
            value={stats.lowHoursCount}
            tone={stats.lowHoursCount > 0 ? "caution" : "ink"}
            corner={<AlertTriangle className={`h-4 w-4 ${stats.lowHoursCount > 0 ? "text-caution" : "text-faint"}`} aria-hidden />}
          />
        </InstrumentRow>
      )}

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search student or course…"
        aria-label="Search students"
        className="max-w-sm"
      />

      {/* Students table */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={search ? "No students match your search" : "No students assigned to you yet"}
            description={search ? "Try a different student or course name." : "Students appear here once an admin assigns them to you."}
            action={search ? <Button variant="secondary" size="sm" onClick={() => setSearch("")}>Clear Search</Button> : undefined}
          />
        </Card>
      ) : (
        <TableShell>
          <Table>
            <THead>
              <tr>
                <Th>Student</Th>
                <Th>Course</Th>
                <Th>Hours Progress</Th>
                <Th>Status</Th>
                <Th className="text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </THead>
            <tbody>
              {slice.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <p className="font-semibold text-ink">{s.fullName}</p>
                    {s.expectedCompletionDate && (
                      <p className="readout text-[11px] text-faint" data-numeric>Target: {s.expectedCompletionDate}</p>
                    )}
                  </Td>
                  <Td className="text-dim">{s.course}</Td>
                  <Td><HoursProgress total={s.totalRegisteredHours} completed={s.completedHours} compact /></Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td className="text-right">
                    <Button variant="primary" size="sm" onClick={() => openDrawer(s)}>
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Class / History
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <TableFooter>
            <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
          </TableFooter>
        </TableShell>
      )}

      {/* Recently recorded classes */}
      {recent.length > 0 && (
        <div>
          <p className="placard mb-2">Recently Recorded</p>
          <div className="space-y-1.5">
            {recent.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3 rounded-ctl border border-bezel bg-face px-3 py-2 text-sm">
                <span className="font-medium text-ink">{r.studentName}</span>
                <span className="text-xs text-faint">{r.course}</span>
                <span className="readout text-xs text-faint" data-numeric>{r.classDate}</span>
                <span className="readout ml-auto text-xs font-bold text-dim" data-numeric>{r.deliveredHours}h</span>
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
