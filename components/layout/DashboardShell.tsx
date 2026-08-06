"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ImpersonationBanner from "./ImpersonationBanner";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-panel text-ink">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen lg:ps-[248px]">
        {/* One sticky stack: banner and header never fight over top-0 */}
        <div className="sticky top-0 z-30">
          <ImpersonationBanner />
          <Header onMenuOpen={() => setSidebarOpen(true)} />
        </div>
        <main className="mx-auto w-full max-w-[1680px] px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 2xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
