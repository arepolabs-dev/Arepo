import type { Metadata } from "next";
import { displayFont } from "../fonts";
import "../globals.css";
import { GeistSans } from "geist/font/sans";
import { copy } from "@/content/agency/copy";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.arepolabs.com"),
  title: copy.meta.title,
  description: copy.meta.description,
  applicationName: "Arepo Labs",
  openGraph: { title: copy.meta.title, description: copy.meta.description, type: "website" },
};

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${displayFont.variable}`}>
      <body className="font-sans min-h-[100dvh] flex flex-col">{children}</body>
    </html>
  );
}
