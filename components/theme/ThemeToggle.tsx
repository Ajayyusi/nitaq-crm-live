"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#2E7D32] hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:border-slate-700 dark:bg-[#112013] dark:text-slate-300 dark:hover:border-[#2E7D32] dark:hover:bg-[#1a2e1b] dark:hover:text-[#4CAF50]"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
