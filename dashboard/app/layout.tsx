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
  title: "Fieldly Dashboard",
  description:
    "Flexible job forms for field teams — automate invoicing, payments, and reporting.",
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
              background:
                "linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 50%, #F9FAFB 100%)",
            }}
          />
          <Nav />
          {children}
          <Toaster position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
