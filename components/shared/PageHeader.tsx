interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/* Page identity strip — sits on the panel itself, no card chrome. */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-bezel pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {/* Panel lettering: the engraved caps voice of the world */}
        <h1 className="truncate text-[19px] font-bold uppercase tracking-[0.05em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
