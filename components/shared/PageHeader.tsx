interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 border-b border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
