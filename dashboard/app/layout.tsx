import Nav from "@/components/nav";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "./query-provider";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          {/* Clean light background - subtle gradient for depth */}
          <div
            className="fixed inset-0 -z-10"
            style={{
              background:
                "linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 50%, #F9FAFB 100%)",
            }}
          />
          <Nav />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
