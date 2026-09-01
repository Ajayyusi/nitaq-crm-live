"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ImpersonationBanner from "./ImpersonationBanner";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-panel text-ink">
      {/* Mobile backdrop overlay. z-35 sits above the sticky header stack
          (z-30) but below the sidebar (z-40) — at z-30 the header rendered
          later in the DOM and stayed lit and clickable behind the nav. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[35] bg-[rgba(27,36,48,0.45)] backdrop-blur-[3px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen lg:ps-[288px]">
        {/* One sticky stack: banner and header never fight over top-0 */}
        <div className="sticky top-0 z-30">
          <ImpersonationBanner />
          <Header onMenuOpen={() => setSidebarOpen(true)} />
        </div>
        <main className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 2xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
