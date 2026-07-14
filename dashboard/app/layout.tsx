import Nav from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
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
  title: "Tally Runner - Field Service Management for Service Businesses",
  description:
    "Manage your field workers, jobs, and invoicing in one place. Perfect for tradespeople, car detailers, and service contractors.",
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
        suppressHydrationWarning
      >
        <QueryProvider>
          {/* Clean light background - subtle gradient for depth */}
          <div
            className="fixed inset-0 -z-10"
            style={{
              background: "linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 50%, #F9FAFB 100%)",
            }}
          />
          <Nav />
          {children}
          <Toaster position="bottom-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
