import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Nitaq Academy CRM",
  description: "Academy Operations & CRM System — Sharjah, UAE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
        suppressHydrationWarning
        style={{
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* Runs before hydration to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
