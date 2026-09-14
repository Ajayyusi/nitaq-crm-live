import { stagger } from "@/lib/motion";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/* Page identity strip — sits on the ground, not on a card, so the first
   raised surface a reader meets is actual content. The title rises first and
   the actions follow, so the eye lands on where you are before what you can do. */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="motion-rise min-w-0" style={stagger(0)}>
        <h1 className="truncate text-[26px] font-extrabold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-dim">{subtitle}</p>}
      </div>
      {actions && (
        <div className="motion-rise flex flex-shrink-0 flex-wrap items-center gap-3" style={stagger(1)}>
          {actions}
        </div>
      )}
    </div>
  );
}
