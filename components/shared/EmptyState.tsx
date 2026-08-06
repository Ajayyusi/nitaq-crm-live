import { LucideIcon } from "lucide-react";

/* Empty is a system state, not a decoration: dim instrument, clear next act. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-bezel bg-well">
        <Icon className="h-5 w-5 text-faint" aria-hidden />
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-dim">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
