"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users, TrendingUp, BookOpen, UserCheck, ClipboardList,
  DollarSign, Calendar, AlertCircle, Plus, Upload, Download,
} from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const role = (session?.user as any)?.role;

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-24 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-24 mb-3" />
              <div className="h-7 bg-slate-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Sales Dashboard
  if (role === "sales") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sales Dashboard</h2>
          <p className="text-sm text-slate-500">Your performance overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="New Leads Today" value={stats?.newLeadsToday || 0} icon={TrendingUp} iconColor="text-blue-600" iconBg="bg-blue-50" />
          <KPICard title="Leads This Week" value={stats?.leadsThisWeek || 0} icon={Users} iconColor="text-green-600" iconBg="bg-green-50" />
          <KPICard title="Follow-ups Due" value={stats?.followUpsDue || 0} icon={AlertCircle} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <KPICard title="Enrolled This Month" value={stats?.enrolledThisMonth || 0} icon={ClipboardList} iconColor="text-purple-600" iconBg="bg-purple-50" />
        </div>

        {/* Pipeline */}
        {stats?.leadsByStatus && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Pipeline by Stage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.leadsByStatus.map((d: any) => ({ name: d._id, count: d.count }))}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction href="/leads/new" icon={Plus} label="Add New Lead" color="bg-blue-600" />
          <QuickAction href="/leads" icon={TrendingUp} label="View All Leads" color="bg-slate-700" />
        </div>
      </div>
    );
  }

  // Admin / Super Admin Dashboard
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Operations Dashboard</h2>
          <p className="text-sm text-slate-500">
            Welcome back, {session?.user?.name} · {new Date().toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Students" value={stats?.totalStudents || 0} subtitle="Active enrollees" icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <KPICard title="Active Teachers" value={stats?.totalTeachers || 0} subtitle="Currently teaching" icon={UserCheck} iconColor="text-green-600" iconBg="bg-green-50" />
        <KPICard title="Active Courses" value={stats?.totalCourses || 0} subtitle="Available programs" icon={BookOpen} iconColor="text-purple-600" iconBg="bg-purple-50" />
        <KPICard title="Revenue This Month" value={formatCurrency(stats?.revenueThisMonth || 0)} subtitle="Payments received" icon={DollarSign} iconColor="text-amber-600" iconBg="bg-amber-50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="New Leads" value={stats?.newLeadsThisMonth || 0} subtitle="This month" icon={TrendingUp} iconColor="text-teal-600" iconBg="bg-teal-50" />
        <KPICard title="Active Enrollments" value={stats?.activeEnrollments || 0} subtitle="Currently active" icon={ClipboardList} iconColor="text-indigo-600" iconBg="bg-indigo-50" />
        <KPICard title="Total Leads" value={stats?.totalLeads || 0} subtitle="All time" icon={AlertCircle} iconColor="text-orange-600" iconBg="bg-orange-50" />
        <KPICard title="Classes Today" value="—" subtitle="Scheduled" icon={Calendar} iconColor="text-rose-600" iconBg="bg-rose-50" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-1">Lead Pipeline</h3>
          <p className="text-xs text-slate-400 mb-4">Current distribution by status</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(stats?.leadsByStatus || []).map((d: any) => ({
              name: d._id?.replace("_", " ") || "Unknown",
              count: d.count,
            }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(stats?.leadsByStatus || []).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Enrollment trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Enrollments</h3>
          <p className="text-xs text-slate-400 mb-4">Last 6 months</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={(stats?.enrollmentsByMonth || []).reverse().map((d: any) => ({
              month: `${d._id.month}/${d._id.year.toString().slice(2)}`,
              count: d.count,
            }))}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/leads/new" icon={Plus} label="Add Lead" color="bg-blue-600" />
          <QuickAction href="/teachers/new" icon={UserCheck} label="Add Teacher" color="bg-green-600" />
          <QuickAction href="/courses/new" icon={BookOpen} label="Add Course" color="bg-purple-600" />
          <QuickAction href="/import-export" icon={Upload} label="Import CSV" color="bg-amber-600" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, color }: { href: string; icon: any; label: string; color: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
    >
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </Link>
  );
}
