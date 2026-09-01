"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--edge)",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "var(--radius-ctl)",
              padding: "12px 16px",
              boxShadow: "var(--shadow-pop)",
            },
            success: {
              iconTheme: { primary: "var(--ok)", secondary: "var(--surface)" },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: "var(--danger)", secondary: "var(--surface)" },
            },
          }}
        />
      </SessionProvider>
    </ThemeProvider>
  );
}
