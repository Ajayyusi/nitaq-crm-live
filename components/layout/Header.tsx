import { Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-8 2xl:px-10">
        <div>
          <p className="text-sm font-bold text-[#0D1F0E]">Nitaq Academy</p>
          <p className="mt-0.5 text-xs text-slate-500">
            CRM &amp; Operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-green-200 bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#2E7D32] lg:inline-flex">
            Sharjah
          </span>
          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#2E7D32] ring-2 ring-white" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1B5E20] text-xs font-bold text-white shadow-sm">
            NA
          </div>
        </div>
      </div>
    </header>
  );
}
