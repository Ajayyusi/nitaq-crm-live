import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Readex_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

/* Plus Jakarta Sans carries the interface: a humanist geometric with real
   tabular figures, so a column of money lines up without a separate mono.
   Readex Pro carries Arabic. */
const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nitaq Academy CRM",
  description: "Academy Operations & CRM System — Sharjah, UAE",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nitaq CRM",
    startupImage: "/icon-512.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#EEF1F5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#21252C" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${jakarta.variable} ${readex.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Runs before hydration to prevent theme flash. The soft light panel
            is the default — neomorphic depth needs a white highlight to exist.
            Dark is the explicit opt-in ("theme" = "dark"). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
