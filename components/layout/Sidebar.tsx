"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  BookMarked,
  BookOpen,
  Calculator,
  CalendarDays,
  Coins,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
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
      { label: "Enroll Requests", href: "/enrollment-requests", icon: ClipboardList },
    ],
  },
  {
    label: "Academy Ops",
    items: [
      { label: "Courses",     href: "/courses",      icon: BookOpen },
      { label: "Trainers",    href: "/teachers",     icon: UserCheck },
      { label: "Enrollments", href: "/enrollments",  icon: ClipboardList },
      { label: "Classes",     href: "/classes",      icon: CalendarDays },
      { label: "My Students", href: "/my-students",  icon: GraduationCap },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Finance",     href: "/finance",      icon: WalletCards },
      { label: "Expenses",    href: "/expenses",     icon: ReceiptText },
      { label: "Collections", href: "/collections",  icon: Coins },
      { label: "Teacher Pay", href: "/teacher-payouts", icon: UserCheck },
      { label: "Reports",     href: "/reports",      icon: BarChart3 },
      { label: "Accounting",  href: "/accounting",           icon: Calculator },
      { label: "Receipts",    href: "/accounting/receipts",  icon: WalletCards },
      { label: "Invoices",    href: "/accounting/invoices",  icon: ReceiptText },
    ],
  },
  {
    label: "Centre Management",
    items: [
      { label: "Compliance",        href: "/compliance",        icon: ShieldCheck },
      { label: "Learner Profiles",  href: "/learner-profiles",  icon: Users },
      { label: "Qualifications",    href: "/qualifications",    icon: BookMarked },
      { label: "Assessments",       href: "/assessments",       icon: ClipboardCheck },
      { label: "IQA Sampling",      href: "/iqa",               icon: ClipboardList },
      { label: "Staff Compliance",  href: "/staff-compliance",  icon: UserCog },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Activity Log",    href: "/activity",       icon: Activity },
      { label: "Import / Export", href: "/import-export",  icon: ArrowUpDown },
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
    <span
      className="readout ml-auto rounded-neo-xs border border-warn/25 bg-[var(--warn-soft)] px-1.5 py-px text-[10px] font-bold leading-4 text-warn"
      data-numeric
      aria-label={`${count} follow-ups due today`}
    >
      {count}
    </span>
  );
}

/** Gauge-true product mark: a needle at rest inside a ticked bezel.
    Coordinates are static strings — computed floats hydrate inconsistently. */
const MARK_TICKS: [string, string, string, string][] = [
  ["18", "4.5", "18", "7.5"],
  ["24.75", "6.31", "24", "7.61"],
  ["29.69", "11.25", "28.39", "12"],
  ["31.5", "18", "28.5", "18"],
  ["29.69", "24.75", "28.39", "24"],
  ["24.75", "29.69", "24", "28.39"],
  ["18", "31.5", "18", "28.5"],
  ["11.25", "29.69", "12", "28.39"],
  ["6.31", "24.75", "7.61", "24"],
  ["4.5", "18", "7.5", "18"],
  ["6.31", "11.25", "7.61", "12"],
  ["11.25", "6.31", "12", "7.61"],
];

function Mark() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="var(--well)" stroke="var(--bezel-strong)" />
      {MARK_TICKS.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--dim)" strokeWidth="1" />
      ))}
      <line x1="18" y1="18" x2="26.5" y2="9.5" stroke="var(--phos)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2" fill="var(--phos)" />
    </svg>
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

    function onLogoUpdated(e: Event) {
      setLogoBase64((e as CustomEvent<{ logoBase64: string }>).detail.logoBase64 ?? "");
    }
    window.addEventListener("logo-updated", onLogoUpdated);
    return () => window.removeEventListener("logo-updated", onLogoUpdated);
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
      className={`fixed inset-y-0 start-0 z-40 flex w-[264px] flex-col bg-face shadow-neo transition-transform duration-300 lg:inset-y-3 lg:start-3 lg:rounded-neo ${
        isOpen
          ? "translate-x-0"
          : "ltr:-translate-x-full rtl:translate-x-full lg:ltr:translate-x-0 lg:rtl:translate-x-0"
      }`}
      aria-label="Main navigation"
    >
      {/* Identity plate */}
      <div className="flex items-center gap-3 border-b border-edge px-5 py-5">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-full">
          {logoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoBase64} alt="Academy logo" className="h-full w-full object-contain" />
          ) : (
            <Mark />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight text-ink">Nitaq Academy</p>
          <p className="placard mt-0.5">Operations</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-neo-sm text-dim transition hover:bg-well hover:text-ink active:shadow-neo-inset-sm lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-5">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="placard mb-2 px-3">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex min-h-10 items-center gap-3 rounded-neo-sm px-3 py-2.5 text-[13px] font-semibold transition-[box-shadow,background-color,color] duration-200 ease-out ${
                      active
                        ? "bg-well text-accent shadow-neo-inset-sm"
                        : "text-dim hover:bg-well/60 hover:text-ink"
                    }`}
                  >
                    {/* Accent rail: state must not depend on reading a shadow */}
                    <span
                      aria-hidden
                      className={`absolute start-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full transition-all duration-200 ${
                        active ? "bg-accent" : "bg-transparent"
                      }`}
                    />
                    <Icon
                      className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                        active ? "text-accent" : "text-faint group-hover:text-dim"
                      }`}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {item.badge && <FollowUpBadge />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Crew plate */}
      <div className="border-t border-edge p-3.5">
        <div className="flex items-center gap-3 rounded-neo-sm bg-well p-3 shadow-neo-inset-sm">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink shadow-neo-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink">{fullName}</p>
            <p className="placard mt-px">{userRoleLabels[role] ?? role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            aria-label="Sign out"
            className="flex-shrink-0 rounded-neo-xs p-2 text-faint transition hover:bg-face hover:text-danger active:shadow-neo-inset-sm"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
