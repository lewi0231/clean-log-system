"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface PageTourContextType {
  isTourActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  hasSeenTour: boolean;
  hasSkippedTour: boolean;
  showTourPrompt: boolean;
  dismissTourPrompt: () => void;
}

const PageTourContext = createContext<PageTourContextType | undefined>(
  undefined
);

interface PageTourProviderProps {
  children: ReactNode;
  pageId: string;
  totalSteps: number;
}

export function PageTourProvider({
  children,
  pageId,
  totalSteps,
}: PageTourProviderProps) {
  const storageKey = `page-tour-${pageId}`;
  const promptKey = `page-tour-prompt-${pageId}`;

  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Initialize state from localStorage using lazy initialization
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "completed";
  });

  const [hasSkippedTour, setHasSkippedTour] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "skipped";
  });

  const [showTourPrompt, setShowTourPrompt] = useState(() => {
    if (typeof window === "undefined") return false;
    const tourState = localStorage.getItem(storageKey);
    const promptState = localStorage.getItem(promptKey);
    return !tourState && !promptState;
  });

  // Sync state with localStorage changes (e.g., from other tabs)
  useEffect(() => {
    const handleStorageChange = () => {
      const tourState = localStorage.getItem(storageKey);
      const promptState = localStorage.getItem(promptKey);

      setHasSeenTour(tourState === "completed");
      setHasSkippedTour(tourState === "skipped");
      setShowTourPrompt(!tourState && !promptState);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [storageKey, promptKey]);

  const startTour = () => {
    setIsTourActive(true);
    setCurrentStep(0);
    setShowTourPrompt(false);
    localStorage.setItem(promptKey, "dismissed");
  };

  const endTour = () => {
    setIsTourActive(false);
    setCurrentStep(0);
    setHasSeenTour(true);
    localStorage.setItem(storageKey, "completed");
  };

  const skipTour = () => {
    setIsTourActive(false);
    setCurrentStep(0);
    setHasSkippedTour(true);
    setShowTourPrompt(false);
    localStorage.setItem(storageKey, "skipped");
    localStorage.setItem(promptKey, "dismissed");
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const dismissTourPrompt = () => {
    setShowTourPrompt(false);
    localStorage.setItem(promptKey, "dismissed");
  };

  return (
    <PageTourContext.Provider
      value={{
        isTourActive,
        currentStep,
        totalSteps,
        startTour,
        endTour,
        nextStep,
        previousStep,
        skipTour,
        hasSeenTour,
        hasSkippedTour,
        showTourPrompt,
        dismissTourPrompt,
      }}
    >
      {children}
    </PageTourContext.Provider>
  );
}

export function usePageTour() {
  const context = useContext(PageTourContext);
  if (context === undefined) {
    throw new Error("usePageTour must be used within a PageTourProvider");
  }
  return context;
}
