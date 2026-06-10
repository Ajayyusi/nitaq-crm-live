"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#E8F5E9] text-slate-950">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen lg:pl-[260px]">
        <Header onMenuOpen={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1680px] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 2xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
