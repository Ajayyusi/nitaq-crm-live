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
              background: "#0D1F0E",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "10px",
              padding: "12px 16px",
            },
            success: {
              iconTheme: { primary: "#4CAF50", secondary: "#fff" },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: "#EF5350", secondary: "#fff" },
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
    </ThemeProvider>
  );
}
