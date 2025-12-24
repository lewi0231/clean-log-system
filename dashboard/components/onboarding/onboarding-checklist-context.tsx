"use client";

import { createContext, ReactNode, useContext, useState } from "react";

interface OnboardingChecklistContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isDismissed: boolean;
  setIsDismissed: (dismissed: boolean) => void;
}

const OnboardingChecklistContext = createContext<
  OnboardingChecklistContextType | undefined
>(undefined);

export function OnboardingChecklistProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("onboarding-checklist-dismissed") === "true";
    }
    return false;
  });

  const handleSetDismissed = (dismissed: boolean) => {
    setIsDismissed(dismissed);
    if (typeof window !== "undefined") {
      if (dismissed) {
        localStorage.setItem("onboarding-checklist-dismissed", "true");
      } else {
        localStorage.removeItem("onboarding-checklist-dismissed");
      }
    }
  };

  return (
    <OnboardingChecklistContext.Provider
      value={{
        isOpen,
        setIsOpen,
        isDismissed,
        setIsDismissed: handleSetDismissed,
      }}
    >
      {children}
    </OnboardingChecklistContext.Provider>
  );
}

export function useOnboardingChecklist() {
  const context = useContext(OnboardingChecklistContext);
  if (context === undefined) {
    throw new Error(
      "useOnboardingChecklist must be used within OnboardingChecklistProvider"
    );
  }
  return context;
}
