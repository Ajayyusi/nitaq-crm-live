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
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-well shadow-neo-inset">
        <Icon className="h-6 w-6 text-faint" aria-hidden />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-dim">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
