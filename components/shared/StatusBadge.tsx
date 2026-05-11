import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  // Lead statuses
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  trial_booked: "bg-purple-50 text-purple-700 border-purple-200",
  trial_done: "bg-amber-50 text-amber-700 border-amber-200",
  enrolled: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  on_hold: "bg-slate-100 text-slate-600 border-slate-200",
  // Enrollment / class
  active: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  rescheduled: "bg-orange-50 text-orange-700 border-orange-200",
  no_show: "bg-red-50 text-red-700 border-red-200",
  // Teachers
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
  on_leave: "bg-orange-50 text-orange-700 border-orange-200",
  // Allocation
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-teal-50 text-teal-700 border-teal-200",
};

const LABEL_MAP: Record<string, string> = {
  trial_booked: "Trial Booked",
  trial_done: "Trial Done",
  on_hold: "On Hold",
  on_leave: "On Leave",
  no_show: "No Show",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200";
  const label = LABEL_MAP[status] || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", style, className)}>
      {label}
    </span>
  );
}
