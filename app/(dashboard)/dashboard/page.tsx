import { BookOpen, CalendarClock, CircleDollarSign, GraduationCap, HandCoins, UserPlus, UsersRound } from "lucide-react";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";

async function getLeadStats() {
  try {
    await connectDB();
    const [total, newLeads, followUp, converted] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: "New" }),
      Lead.countDocuments({ status: "Follow Up" }),
      Lead.countDocuments({ status: "Converted" }),
    ]);
    return { total, newLeads, followUp, converted, connected: true };
  } catch {
    return { total: 0, newLeads: 0, followUp: 0, converted: 0, connected: false };
  }
}

export default async function DashboardPage() {
  const leadStats = await getLeadStats();
  const cards = [
    { title: "Total Leads", value: leadStats.total.toLocaleString(), note: leadStats.connected ? "All inquiries in MongoDB" : "Add MONGODB_URI to enable live data", icon: UserPlus, color: "bg-teal-50 text-teal-700" },
    { title: "New Leads", value: leadStats.newLeads.toLocaleString(), note: "Fresh inquiries awaiting contact", icon: UserPlus, color: "bg-sky-50 text-sky-700" },
    { title: "Follow-up Leads", value: leadStats.followUp.toLocaleString(), note: "Leads marked for follow-up", icon: CalendarClock, color: "bg-amber-50 text-amber-700" },
    { title: "Converted Leads", value: leadStats.converted.toLocaleString(), note: "Leads converted to students", icon: GraduationCap, color: "bg-emerald-50 text-emerald-700" },
    { title: "Monthly Revenue", value: "AED 186K", note: "Dummy until Finance is connected", icon: CircleDollarSign, color: "bg-violet-50 text-violet-700" },
    { title: "Pending Payments", value: "AED 42K", note: "Dummy until Enrollments are connected", icon: HandCoins, color: "bg-rose-50 text-rose-700" },
    { title: "Upcoming Classes", value: "24", note: "Dummy until Classes are connected", icon: BookOpen, color: "bg-indigo-50 text-indigo-700" },
    { title: "Available Teachers", value: "16", note: "Dummy until Teachers are connected", icon: UsersRound, color: "bg-slate-100 text-slate-700" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">Nitaq Academy</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Operations Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Live admissions metrics now come from the Leads database. Other modules remain ready for the next build phases.
          </p>
        </div>
        <span className="w-fit rounded-md bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
          {leadStats.connected ? "MongoDB connected" : "MongoDB setup needed"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={card.title}>
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${card.color}`}><Icon className="h-5 w-5" /></div>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-900">{card.value}</p>
              <p className="mt-1 text-sm text-slate-500">{card.note}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Admissions Workspace</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>The Leads module is now functional with create, edit, delete, search, filter, import, and export support.</p>
            <p>Use the sidebar to open Leads and start entering real admissions inquiries.</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Lead Snapshot</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">New</span><span className="font-semibold">{leadStats.newLeads}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Follow Up</span><span className="font-semibold">{leadStats.followUp}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Converted</span><span className="font-semibold">{leadStats.converted}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
