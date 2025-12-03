import Nav from "@/components/nav";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Clean Log Dashboard",
  description: "Manage your organization's workers, locations, and jobs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Gradient background - fixed positioning behind all content */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            background:
              "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 25%, #0d1c2e 50%, #1a0f2e 75%, #0a0e27 100%)",
          }}
        />
        <Nav />
        {children}
      </body>
    </html>
  );
}
