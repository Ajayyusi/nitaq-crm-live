import { Search } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({ title = "Internal CRM / ERP", subtitle = "Operations dashboard" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden h-10 w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 lg:flex">
          <Search className="h-4 w-4" />
          <span>Search students, leads, invoices...</span>
        </div>
        <span className="hidden rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">Sharjah</span>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-700 text-xs font-bold text-white">NA</div>
      </div>
    </header>
  );
}
