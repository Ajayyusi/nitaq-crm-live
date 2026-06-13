"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  TrendingUp,
  UserCheck,
  WalletCards,
  BellRing,
  X,
} from "lucide-react";
import { SIDEBAR_VISIBILITY, userRoleLabels } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard },
      { label: "Leads",       href: "/leads",        icon: TrendingUp },
      { label: "Follow-Ups",  href: "/follow-ups",   icon: BellRing, badge: true },
      { label: "Students",    href: "/students",     icon: GraduationCap },
    ],
  },
  {
    label: "Academy Ops",
    items: [
      { label: "Courses",     href: "/courses",      icon: BookOpen },
      { label: "Trainers",    href: "/teachers",     icon: UserCheck },
      { label: "Enrollments", href: "/enrollments",  icon: ClipboardList },
      { label: "Classes",     href: "/classes",      icon: CalendarDays },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Finance",     href: "/finance",      icon: WalletCards },
      { label: "Expenses",    href: "/expenses",     icon: ReceiptText },
      { label: "Reports",     href: "/reports",      icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Import / Export", href: "/import-export", icon: ArrowUpDown },
      { label: "Settings",        href: "/settings",       icon: Settings },
    ],
  },
];

function FollowUpBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/follow-ups?view=today&status=Pending")
      .then((r) => r.json())
      .then((d) => setCount(d.followUps?.length ?? 0))
      .catch(() => {});
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold leading-none text-[#0D1F0E]">
      {count}
    </span>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [logoBase64, setLogoBase64] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setLogoBase64(d.logoBase64 ?? ""))
      .catch(() => {});
  }, []);

  const user = session?.user;
  const fullName = user?.name ?? "Staff";
  const role = ((user as { role?: string })?.role ?? "sales") as AppRole;
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const allowed = SIDEBAR_VISIBILITY[item.href];
        return !allowed || (allowed as string[]).includes(role);
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#1B5E20] text-white shadow-2xl shadow-green-950/20 transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      {/* Logo */}
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white text-sm font-extrabold tracking-wider text-[#1B5E20] shadow-lg dark:bg-green-200 dark:text-[#1B5E20] overflow-hidden">
            {logoBase64 ? (
              <img src={logoBase64} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              "NA"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold tracking-tight text-white">Nitaq Academy</p>
            <p className="mt-0.5 text-xs font-medium text-green-200">Internal CRM</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="lg:hidden grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-300">Sharjah</p>
          <p className="mt-0.5 text-xs text-green-100">Training center operations</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-green-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[#2E7D32] text-white shadow-md shadow-green-950/20"
                        : "text-green-100 hover:bg-white/[0.09] hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 ${
                        active ? "text-white" : "text-green-300 group-hover:text-green-200"
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.badge && <FollowUpBadge />}
                    {active && !item.badge && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/[0.08] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#1B5E20] dark:bg-green-200 dark:text-[#1B5E20]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{fullName}</p>
              <p className="text-xs text-green-300">{userRoleLabels[role] ?? role}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="flex-shrink-0 rounded-lg p-1.5 text-green-300 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
