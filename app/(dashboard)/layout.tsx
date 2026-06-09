import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#E8F5E9] text-slate-950">
      <Sidebar />
      <div className="min-h-screen pl-[260px]">
        <Header />
        <main className="mx-auto w-full max-w-[1680px] px-8 py-8 2xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}