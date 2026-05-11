"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn, getInitials } from "@/lib/utils";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, UserCheck,
  ClipboardList, Calendar, DollarSign, BarChart3, Upload,
  Settings, LogOut, ChevronDown, School, Layers, UserCog,
  FileText, Bell, CreditCard, TrendingUp, BookMarked,
} from "lucide-react";
import { useState } from "react";
import { Role } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "sales", "teacher", "finance", "academic"],
  },
  {
    label: "Leads CRM",
    href: "/leads",
    icon: TrendingUp,
    roles: ["super_admin", "admin", "sales", "academic"],
  },
  {
    label: "Students",
    href: "/students",
    icon: GraduationCap,
    roles: ["super_admin", "admin", "academic", "finance"],
  },
  {
    label: "Enrollments",
    href: "/enrollments",
    icon: ClipboardList,
    roles: ["super_admin", "admin", "academic", "finance"],
  },
  {
    label: "Teachers",
    href: "/teachers",
    icon: UserCheck,
    roles: ["super_admin", "admin", "academic"],
  },
  {
    label: "Allocations",
    href: "/allocations",
    icon: UserCog,
    roles: ["super_admin", "admin", "sales", "academic"],
  },
  {
    label: "Courses",
    href: "/courses",
    icon: BookOpen,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Classes",
    href: "/classes",
    icon: Calendar,
    roles: ["super_admin", "admin", "academic", "teacher"],
  },
  {
    label: "Payments",
    href: "/payments",
    icon: CreditCard,
    roles: ["super_admin", "admin", "finance"],
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: DollarSign,
    roles: ["super_admin", "admin", "finance"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["super_admin", "admin", "finance"],
  },
  {
    label: "Import / Export",
    href: "/import-export",
    icon: Upload,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["super_admin"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["super_admin", "admin"],
  },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role as Role;
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 flex flex-col z-40 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <BookMarked className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-none">Nitaq CRM</p>
            <p className="text-slate-500 text-xs mt-0.5">Operations</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-slate-500 hover:text-white transition"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", collapsed ? "-rotate-90" : "rotate-90")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-800 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {getInitials(session?.user?.name || "U")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-slate-500 text-xs capitalize truncate">
                {role?.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-slate-500 hover:text-red-400 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center text-slate-500 hover:text-red-400 transition py-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
