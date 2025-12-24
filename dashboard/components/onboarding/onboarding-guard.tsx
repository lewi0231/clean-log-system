"use client";

import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { onboardingStatus, loading } = useOnboardingStatus();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect if we're already on onboarding pages
    if (
      pathname === "/onboarding" ||
      pathname?.startsWith("/dashboard/onboarding")
    ) {
      return;
    }

    // Don't redirect if still loading
    if (loading) {
      return;
    }

    // Redirect to onboarding if not completed and trying to access dashboard
    if (
      onboardingStatus &&
      !onboardingStatus.completed &&
      pathname?.startsWith("/dashboard")
    ) {
      router.push("/onboarding");
    }
  }, [onboardingStatus, loading, router, pathname]);

  // Show loading state while checking
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If onboarding not completed and not on onboarding page, don't render children
  // (redirect will happen in useEffect)
  if (
    onboardingStatus &&
    !onboardingStatus.completed &&
    !pathname?.startsWith("/onboarding") &&
    !pathname?.startsWith("/dashboard/onboarding")
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Redirecting to onboarding...</p>
      </div>
    );
  }

  return <>{children}</>;
}
