import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nitaq Operations CRM",
  description: "Academy Operations & CRM System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
