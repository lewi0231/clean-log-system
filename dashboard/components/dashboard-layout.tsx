"use client";

import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { OnboardingChecklistProvider } from "@/components/onboarding/onboarding-checklist-context";
import { OnboardingGuard } from "@/components/onboarding/onboarding-guard";
import DashboardSidebar from "./dashboard-sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <OnboardingGuard>
      <OnboardingChecklistProvider>
        <div className="flex min-h-screen relative">
          <DashboardSidebar />
          <main className="flex-1 ml-64 pt-20">
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-[calc(100%-3rem)]">
              {children}
            </div>
          </main>
          <OnboardingChecklist />
        </div>
      </OnboardingChecklistProvider>
    </OnboardingGuard>
  );
}
