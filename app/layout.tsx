import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  metadataBase: new URL("https://rattafy.vercel.app"),
  title: "Rattafy - exam tonight? plan in 30 seconds",
  description:
    "Paste your syllabus, tell us how many hours you have left, and get a ruthless AI study plan: what to study, what to skim, what to sacrifice.",
  openGraph: {
    title: "Rattafy - exam tonight? plan in 30 seconds",
    description:
      "AI cram planner for students. Study ⚡ Skim 👀 Sacrifice 💀",
    url: "https://rattafy.vercel.app",
    siteName: "Rattafy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rattafy - exam tonight? plan in 30 seconds",
    description:
      "AI cram planner for students. Study ⚡ Skim 👀 Sacrifice 💀",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
