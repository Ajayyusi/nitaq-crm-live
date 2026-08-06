import { Lamp, type LampVariant } from "@/components/ui/lamp";

/*
 * Every business status, mapped once to the annunciator vocabulary:
 * ok (running normally) · caution (needs attention) · alert (breach) ·
 * advisory (informational) · off (inert/closed).
 */
const STATUS_VARIANT: Record<string, LampVariant> = {
  // Lead pipeline
  new: "advisory",
  contacted: "advisory",
  interested: "advisory",
  trial_booked: "advisory",
  trial_done: "caution",
  "follow-up": "caution",
  enrolled: "ok",
  converted: "ok",
  lost: "off",
  not_interested: "off",
  on_hold: "caution",
  // Enrollment / class
  active: "ok",
  completed: "off",
  paused: "caution",
  cancelled: "alert",
  dropped: "alert",
  scheduled: "advisory",
  rescheduled: "caution",
  no_show: "alert",
  // Payments
  paid: "ok",
  "paid full": "ok",
  received: "ok",
  pending: "caution",
  overdue: "alert",
  refunded: "advisory",
  free: "advisory",
  // Teachers / staff
  inactive: "off",
  on_leave: "caution",
  // Allocation
  confirmed: "ok",
  // Accounting
  posted: "ok",
  draft: "caution",
  reversed: "off",
  // Compliance
  valid: "ok",
  expiring: "caution",
  expired: "alert",
  missing: "alert",
};

const LABEL_MAP: Record<string, string> = {
  trial_booked: "Trial Booked",
  trial_done: "Trial Done",
  on_hold: "On Hold",
  on_leave: "On Leave",
  no_show: "No Show",
  not_interested: "Not Interested",
  "paid full": "Paid Full",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const variant =
    STATUS_VARIANT[key] ?? STATUS_VARIANT[status.toLowerCase()] ?? ("off" as LampVariant);
  const label =
    LABEL_MAP[key] ?? LABEL_MAP[status.toLowerCase()] ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Lamp variant={variant} className={className}>
      {label}
    </Lamp>
  );
}
