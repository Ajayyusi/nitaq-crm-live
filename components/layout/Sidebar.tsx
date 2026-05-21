"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Settings,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: TrendingUp },
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Teachers", href: "/teachers", icon: UserCheck },
  { label: "Enrollments", href: "/enrollments", icon: ClipboardList },
  { label: "Classes", href: "/classes", icon: Calendar },
  { label: "Finance", href: "/finance", icon: DollarSign },
  { label: "Expenses", href: "/expenses", icon: DollarSign },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-700 text-sm font-bold text-white">NA</div>
          <div>
            <p className="text-sm font-bold text-slate-900">Nitaq Academy</p>
            <p className="text-xs text-slate-500">Sharjah Training Center</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (pathname === "/" && item.href === "/dashboard");
          return (
            <Link
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs font-medium text-slate-500">Functional CRM</p>
        <p className="mt-1 text-xs text-slate-400">Leads module active</p>
      </div>
    </aside>
  );
}
