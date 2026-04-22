"use client";

import { Button } from "@/components/ui/button";
import { log } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePageTour } from "./page-tour-context";

export interface TourStep {
  target: string; // CSS selector or data attribute
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  offset?: number;
}

interface PageTourTooltipProps {
  steps: TourStep[];
}

export function PageTourTooltip({ steps }: PageTourTooltipProps) {
  const { isTourActive, currentStep, totalSteps, nextStep, previousStep, endTour } = usePageTour();

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];

  // Cleanup all tour highlights when tour ends
  useEffect(() => {
    if (!isTourActive) {
      // Remove tour-highlight class from all elements when tour ends
      const highlightedElements = document.querySelectorAll(".tour-highlight");
      highlightedElements.forEach((el) => {
        el.classList.remove("tour-highlight");
      });
      setTargetElement(null);
    }
  }, [isTourActive]);

  // Find and highlight target element
  useEffect(() => {
    if (!isTourActive || !currentStepData) {
      return;
    }

    // Cleanup previous highlight before finding new element
    const previousHighlighted = document.querySelectorAll(".tour-highlight");
    previousHighlighted.forEach((el) => {
      el.classList.remove("tour-highlight");
    });

    // Try to find element by data attribute first, then by selector
    let element: HTMLElement | null = null;

    if (currentStepData.target.startsWith("[data-")) {
      const attr = currentStepData.target.slice(1, -1); // Remove brackets
      const [key, value] = attr.split("=");
      const cleanKey = key.trim();
      const cleanValue = value?.replace(/['"]/g, "").trim();
      element = document.querySelector(
        cleanValue ? `[${cleanKey}="${cleanValue}"]` : `[${cleanKey}]`
      ) as HTMLElement;
    } else {
      element = document.querySelector(currentStepData.target) as HTMLElement;
    }

    if (element) {
      // For very large elements, use a more specific reference point
      // If element is larger than 80% of viewport, use top-left corner instead
      const rect = element.getBoundingClientRect();
      const isVeryLarge =
        rect.width > window.innerWidth * 0.8 || rect.height > window.innerHeight * 0.8;

      // If element is a tab trigger, click it to select the tab
      // Check if it's a Radix UI TabsTrigger or has tab-related attributes
      const isTabTrigger =
        element.getAttribute("role") === "tab" ||
        element.hasAttribute("data-state") ||
        element.closest('[role="tablist"]') !== null ||
        (element.hasAttribute("data-tour") &&
          (element.getAttribute("data-tour")?.includes("tab") ||
            element.getAttribute("data-tour")?.includes("pricing")));

      if (isTabTrigger && element instanceof HTMLElement) {
        // Wait for any ongoing scrolls to complete, then switch tabs
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          setTimeout(() => {
            // Try to find the button inside if it's wrapped, or click the element itself
            const button = element.querySelector("button") || element;
            if (button instanceof HTMLElement) {
              button.click();
            }
          }, 100);
        });
      }

      // If element is a PopoverContent, try to open the popover by clicking its trigger
      // First, find the button that triggers this popover (it should be nearby)
      if (
        element.hasAttribute("data-tour") &&
        element.getAttribute("data-tour") === "add-field-button"
      ) {
        // The PopoverContent might not be in DOM yet, so find the button first
        // Use data-tour-trigger attribute for reliable targeting
        const addFieldButton = document.querySelector(
          '[data-tour-trigger="add-field-popover"]'
        ) as HTMLElement | null;

        if (addFieldButton && addFieldButton instanceof HTMLElement) {
          // Click the button to open the popover
          addFieldButton.click();

          // Wait for popover to appear in DOM, then highlight it
          const checkForPopover = setInterval(() => {
            const popoverContent = document.querySelector(
              '[data-tour="add-field-button"]'
            ) as HTMLElement;
            if (popoverContent) {
              clearInterval(checkForPopover);
              popoverContent.classList.add("tour-highlight");
              // Use a single smooth scroll
              requestAnimationFrame(() => {
                popoverContent.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                  inline: "center",
                });
              });
              setTargetElement(popoverContent);
            }
          }, 50);

          // Timeout after 1 second if popover doesn't appear
          setTimeout(() => clearInterval(checkForPopover), 1000);
          return; // Exit early, we'll handle highlighting in the interval
        }
      }

      // Add highlight class immediately for smooth transition
      element.classList.add("tour-highlight");

      // Scroll element into view with optimized behavior
      // For mobile preview, ensure it's fully visible
      const isMobilePreview =
        element.hasAttribute("data-tour") && element.getAttribute("data-tour") === "mobile-preview";

      // Use requestAnimationFrame to batch DOM operations and prevent jumpiness
      requestAnimationFrame(() => {
        // Small delay to let tab switching complete if needed
        setTimeout(
          () => {
            element?.scrollIntoView({
              behavior: "smooth",
              block: isVeryLarge ? "start" : isMobilePreview ? "start" : "center",
              inline: "center",
            });
          },
          isTabTrigger ? 150 : 0
        );
      });

      // For mobile preview, add extra scroll to ensure it's not cut off at top
      if (isMobilePreview) {
        // Wait for scroll to complete, then check position
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          // If element is cut off at top (rect.top < 20px), scroll more
          if (rect.top < 20) {
            // Scroll so element is at least 100px from top
            const scrollAmount = rect.top - 100;
            window.scrollBy({
              top: scrollAmount,
              behavior: "smooth",
            });
          }
          // Also ensure element is visible in viewport
          if (rect.bottom > viewportHeight) {
            element.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
          }
        }, 600);
      }

      // Update state after DOM operations (defer to avoid cascading renders)
      requestAnimationFrame(() => {
        setTargetElement(element);
      });
    } else {
      // Element not found - auto-skip to next step to prevent tour from hanging
      log.warn(`Tour step target not found: ${currentStepData.target}`);
      if (currentStep < totalSteps - 1) {
        // Skip to next step after a short delay to allow for DOM updates
        setTimeout(() => nextStep(), 100);
      } else {
        // If we're at the last step and element not found, end the tour
        endTour();
      }
    }

    return () => {
      // Cleanup: remove highlight class from element when step changes
      // Use targetElement state which may have been updated for popover content
      if (targetElement) {
        targetElement.classList.remove("tour-highlight");
      } else if (element) {
        // Fallback to the originally found element
        element.classList.remove("tour-highlight");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTourActive,
    currentStep,
    totalSteps,
    nextStep,
    endTour,
    // Only re-run when step changes, not when targetElement changes
    // nextStep, endTour, and totalSteps are stable references from context
  ]);

  // Create overlay backdrop
  useEffect(() => {
    if (!isTourActive || !targetElement) {
      if (overlayRef.current) {
        overlayRef.current.remove();
      }
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-40 pointer-events-auto";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
    overlay.style.backdropFilter = "blur(2px)";
    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    return () => {
      if (overlay) {
        overlay.remove();
      }
    };
  }, [isTourActive, targetElement]);

  // Don't render if tour is not active or no step data
  if (!isTourActive || !currentStepData) {
    return null;
  }

  // If target element is not set yet, wait for it
  if (!targetElement) {
    return null;
  }

  const position = currentStepData.position || "bottom";
  const offset = currentStepData.offset || 12;

  // Calculate position relative to target element
  const rect = targetElement.getBoundingClientRect();
  const tooltipWidth = 320; // w-80 = 320px
  const tooltipHeight = 150; // Approximate height

  // For very large elements, use top-left corner as reference
  const isVeryLarge =
    rect.width > window.innerWidth * 0.8 || rect.height > window.innerHeight * 0.8;

  const getPositionStyles = () => {
    // For very large elements, position tooltip at top-left corner
    const referenceX = isVeryLarge ? rect.left + 20 : rect.left + rect.width / 2;
    const referenceY = isVeryLarge ? rect.top + 20 : rect.top + rect.height / 2;

    switch (position) {
      case "top": {
        const top = (isVeryLarge ? rect.top : referenceY) - tooltipHeight - offset;
        const left = Math.max(
          16,
          Math.min(referenceX - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)
        );
        return {
          top: top < 16 ? (isVeryLarge ? rect.top + 20 : rect.bottom) + offset : top,
          left,
          transform: "translateX(-50%)",
        };
      }
      case "bottom": {
        const top = (isVeryLarge ? rect.top + 60 : rect.bottom) + offset;
        const left = Math.max(16, Math.min(referenceX, window.innerWidth - tooltipWidth / 2 - 16));
        return {
          top:
            top + tooltipHeight > window.innerHeight - 16
              ? (isVeryLarge ? rect.top + 20 : rect.top) - tooltipHeight - offset
              : top,
          left,
          transform: "translateX(-50%)",
        };
      }
      case "left": {
        // Left means tooltip appears on the left side of the element
        const referenceY = isVeryLarge ? rect.top + 20 : rect.top + rect.height / 2;
        const left = (isVeryLarge ? rect.left + 20 : rect.left) - tooltipWidth - offset;
        const top = Math.max(
          16,
          Math.min(referenceY - tooltipHeight / 2, window.innerHeight - tooltipHeight - 16)
        );
        return {
          top,
          left: left < 16 ? (isVeryLarge ? rect.left + 20 : rect.right) + offset : left,
          transform: "translateY(-50%)",
        };
      }
      case "right": {
        // Right means tooltip appears on the right side of the element
        const referenceY = isVeryLarge ? rect.top + 20 : rect.top + rect.height / 2;
        const left = (isVeryLarge ? rect.left + 20 : rect.right) + offset;
        const top = Math.max(
          16,
          Math.min(referenceY - tooltipHeight / 2, window.innerHeight - tooltipHeight - 16)
        );
        return {
          top,
          left:
            left + tooltipWidth > window.innerWidth - 16
              ? (isVeryLarge ? rect.left + 20 : rect.left) - tooltipWidth - offset
              : left,
          transform: "translateY(-50%)",
        };
      }
      default:
        return {};
    }
  };

  const positionStyles = getPositionStyles();

  // Ensure tooltip is always visible in viewport
  // Clamp position to ensure tooltip doesn't overflow
  const clampedStyles: React.CSSProperties = {
    ...positionStyles,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 32px)",
  };

  // Additional clamping to ensure tooltip stays within viewport bounds
  if (typeof positionStyles.top === "number") {
    clampedStyles.top = Math.max(
      16,
      Math.min(positionStyles.top, window.innerHeight - (tooltipHeight + 16))
    );
  }
  if (typeof positionStyles.left === "number") {
    clampedStyles.left = Math.max(
      16,
      Math.min(positionStyles.left, window.innerWidth - (tooltipWidth + 16))
    );
  }

  return (
    <div className="fixed z-50 pointer-events-none" style={clampedStyles}>
      <div
        className={cn(
          "bg-popover border border-border rounded-lg shadow-lg p-0 pointer-events-auto",
          position === "left" || position === "right" ? "w-80 max-w-sm" : "w-80 max-w-md"
        )}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm leading-tight">{currentStepData.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{currentStepData.content}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1 shrink-0"
              onClick={endTour}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={previousStep} className="h-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={currentStep === totalSteps - 1 ? endTour : nextStep}
                className="h-8"
              >
                {currentStep === totalSteps - 1 ? "Finish" : "Next"}
                {currentStep < totalSteps - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add global styles for tour highlight
if (typeof document !== "undefined" && !document.getElementById("tour-styles")) {
  const style = document.createElement("style");
  style.id = "tour-styles";
  style.textContent = `
    .tour-highlight {
      position: relative;
      z-index: 45 !important;
      outline: 3px solid hsl(var(--primary)) !important;
      outline-offset: 2px !important;
      border-radius: 6px;
      box-shadow: 0 0 0 4px rgba(var(--primary-rgb, 59, 130, 246), 0.2) !important;
    }
  `;
  document.head.appendChild(style);
}
