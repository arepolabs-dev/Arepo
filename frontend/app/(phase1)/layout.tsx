import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { displayFont } from "../fonts";
import "../globals.css";

// Private dashboard: never indexed. (No top-level app/layout.tsx exists; each route group has its own root.)
export const metadata: Metadata = {
  title: "Phase 1",
  robots: { index: false, follow: false },
};

export default function Phase1RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-GB"
      className={`${GeistSans.variable} ${GeistMono.variable} ${displayFont.variable}`}
    >
      <body className="font-sans min-h-[100dvh] flex flex-col">{children}</body>
    </html>
  );
}
