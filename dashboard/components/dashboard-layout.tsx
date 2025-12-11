"use client";

import DashboardSidebar from "./dashboard-sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen relative">
      <DashboardSidebar />
      <main className="flex-1 ml-64 pt-20">
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-[calc(100%-2rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}
