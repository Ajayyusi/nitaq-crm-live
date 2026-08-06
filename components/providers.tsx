"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider>
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--raised)",
              color: "var(--ink)",
              border: "1px solid var(--bezel-strong)",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "var(--radius-card, 10px)",
              padding: "12px 16px",
              boxShadow: "var(--shadow-raise)",
            },
            success: {
              iconTheme: { primary: "var(--phos)", secondary: "var(--raised)" },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: "var(--alert)", secondary: "var(--raised)" },
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
    </ThemeProvider>
  );
}
