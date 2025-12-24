"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocations } from "@/hooks/use-locations";
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { CheckCircle2, ListTodo } from "lucide-react";
import { useOnboardingChecklist } from "./onboarding-checklist-context";

export function OnboardingChecklistButton() {
  const { organizationId } = useOrganization();
  const { onboardingStatus, loading: onboardingLoading } =
    useOnboardingStatus();
  const { workers, loading: workersLoading } = useWorkers();
  const { locations, loading: locationsLoading } = useLocations();
  const { fieldConfigs, loading: configLoading } =
    useMobileConfig(organizationId);
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const { isDismissed, setIsDismissed, setIsOpen } = useOnboardingChecklist();

  const loading =
    onboardingLoading ||
    workersLoading ||
    locationsLoading ||
    configLoading ||
    settingsLoading;

  // Only show if onboarding is completed
  if (!onboardingStatus?.completed || loading || !onboardingStatus?.data) {
    return null;
  }

  const onboardingData = onboardingStatus.data;

  // Calculate incomplete steps
  const getIncompleteSteps = () => {
    const steps: string[] = [];

    if (
      onboardingData?.employee_count &&
      onboardingData.employee_count !== "none" &&
      workers.length === 0
    ) {
      steps.push("workers");
    }

    if (onboardingData?.has_locations && locations.length === 0) {
      steps.push("locations");
    }

    if (fieldConfigs.length === 0) {
      steps.push("mobile-config");
    }

    if (!settings?.stripe_account_id) {
      // Payment is optional, but we can still show it
    }

    return steps;
  };

  const incompleteSteps = getIncompleteSteps();
  const hasIncompleteRequiredSteps = incompleteSteps.length > 0;

  // Always show button if there are incomplete required steps
  // OR if checklist was dismissed (so user can reopen it)
  // Hide only if all required steps complete AND checklist is visible (not dismissed)
  if (!hasIncompleteRequiredSteps && !isDismissed) {
    return null;
  }

  const handleOpenChecklist = () => {
    setIsDismissed(false);
    setIsOpen(true);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenChecklist}
            className="relative"
          >
            {hasIncompleteRequiredSteps ? (
              <>
                <ListTodo className="h-4 w-4" />
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {incompleteSteps.length}
                </Badge>
              </>
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Setup</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {hasIncompleteRequiredSteps
              ? `${incompleteSteps.length} setup step${
                  incompleteSteps.length > 1 ? "s" : ""
                } remaining`
              : "View setup checklist"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
