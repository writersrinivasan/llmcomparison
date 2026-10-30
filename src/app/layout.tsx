import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { SNAPSHOT_DATE } from "@/data/catalog";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Compare Hub — models, IDEs & platforms side by side",
  description:
    "One-stop comparison of LLMs, open-weight models, AI IDEs, cloud platforms, agent frameworks, vector databases, assistants and creative tools — with a LangGraph-powered AI advisor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="aurora" aria-hidden />
        <Nav />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50 px-4">
          Editorial snapshot · {SNAPSHOT_DATE} · Ratings are opinions, prices change often — always verify on vendor
          sites.
        </footer>
      </body>
    </html>
  );
}
