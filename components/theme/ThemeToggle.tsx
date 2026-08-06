"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

/* The DIM control: night panel ↔ day panel. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to day panel" : "Switch to night panel"}
      title={theme === "dark" ? "Day panel" : "Night panel"}
      className="grid h-9 w-9 place-items-center rounded-ctl border border-bezel text-dim transition hover:border-phos hover:text-phos"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
