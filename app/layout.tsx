import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavLinks from "./NavLinks";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ground Tank Monitor",
  description: "Monitoring level air tangki realtime via Supabase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-[#0b1120] font-sans text-slate-200 antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900/50 p-4 md:flex">
            <div className="mb-6 flex items-center gap-2.5 px-2">
              <div className="grid h-7 w-7 place-items-center rounded bg-teal-500/10 font-mono text-xs font-semibold text-teal-400 border border-teal-500/20">
                GT
              </div>
              <div className="text-xs font-semibold tracking-wide text-slate-100 uppercase">
                Tank Telemetry
              </div>
            </div>
            <NavLinks />
          </aside>

          <div className="border-b border-slate-800 bg-slate-900/50 p-3 md:hidden">
            <NavLinks />
          </div>

          <main className="flex-1 p-6 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
