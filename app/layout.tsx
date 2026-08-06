import type { Metadata } from "next";
import { B612, B612_Mono, Readex_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

/* Panel typography: B612 was designed by Airbus for cockpit displays —
   the exact lineage of this interface. Readex Pro carries Arabic. */
const b612 = B612({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-b612",
  display: "swap",
});
const b612Mono = B612_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-b612-mono",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0B0D0F" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${b612.variable} ${b612Mono.variable} ${readex.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Runs before hydration to prevent theme flash. Night panel is the
            default; day is the explicit opt-in ("theme" = "light"). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})()`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
