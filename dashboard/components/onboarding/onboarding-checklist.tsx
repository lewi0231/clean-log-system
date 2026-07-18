"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useLocations } from "@/hooks/use-locations";
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  FileText,
  Mail,
  MapPin,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useOnboardingChecklist } from "./onboarding-checklist-context";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  completed: boolean;
  /** Per-step skip (sessionStorage); omit when completed */
  onSkip?: () => void;
}

export function OnboardingChecklist() {
  const { organizationId, userRole, loading: orgLoading } = useOrganization();
  const { onboardingStatus, loading: onboardingLoading } = useOnboardingStatus();
  const { workers, loading: workersLoading } = useWorkers();
  const { locations, loading: locationsLoading } = useLocations();
  const { fieldConfigs, loading: configLoading } = useMobileConfig(organizationId);
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const { isOpen, setIsOpen, isDismissed, setIsDismissed } = useOnboardingChecklist();

  const [emailDomainSkipped, setEmailDomainSkipped] = useState(false);
  const [sendingDomainRow, setSendingDomainRow] = useState<{ display_status: string } | null>(null);
  const [sendingDomainLoading, setSendingDomainLoading] = useState(false);

  // Check if pricing has been configured
  const [hasPricing, setHasPricing] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    const checkPricing = async () => {
      if (!organizationId) {
        setPricingLoading(false);
        return;
      }

      try {
        const { PricingService } = await import("@/lib/services");
        const pricingRules = await PricingService.listRules({
          organization_id: organizationId,
          include_inactive: false,
        });
        setHasPricing(pricingRules.length > 0);
      } catch (err) {
        log.error("Failed to check pricing", err);
        setHasPricing(false);
      } finally {
        setPricingLoading(false);
      }
    };

    checkPricing();
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setEmailDomainSkipped(false);
      return;
    }
    try {
      if (typeof window !== "undefined") {
        setEmailDomainSkipped(
          sessionStorage.getItem(`onboarding-email-domain-skipped:${organizationId}`) === "1"
        );
      }
    } catch {
      setEmailDomainSkipped(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !settings?.custom_email_domain_enabled || userRole !== "admin") {
      setSendingDomainRow(null);
      setSendingDomainLoading(false);
      return;
    }
    let cancelled = false;
    setSendingDomainLoading(true);
    void supabase
      .from("organization_sending_domain")
      .select("display_status")
      .eq("organization_id", organizationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setSendingDomainLoading(false);
        if (error) {
          log.error("onboarding-checklist: organization_sending_domain read failed", { error });
          setSendingDomainRow(null);
          return;
        }
        setSendingDomainRow(data as { display_status: string } | null);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, settings?.custom_email_domain_enabled, userRole]);

  const handleSkipEmailDomain = useCallback(() => {
    if (!organizationId) return;
    try {
      sessionStorage.setItem(`onboarding-email-domain-skipped:${organizationId}`, "1");
    } catch {
      /* ignore private mode / quota */
    }
    setEmailDomainSkipped(true);
  }, [organizationId]);

  // Check if invoice configuration has been set up
  // Invoice config is considered complete when:
  // 1. Logo has been uploaded
  // 2. Currency has been set (not default)
  // 3. User has visited organization settings
  const hasLogo = !!settings?.logo_url;
  const hasCurrency = settings?.currency && settings.currency !== "AUD"; // Check if explicitly set (not just default)
  // For now, we'll check if they've at least set a logo or changed currency
  // The real check should be: hasLogo && hasCurrency, but we'll be lenient
  const hasInvoiceConfig = Boolean(hasLogo || hasCurrency);

  const loading =
    onboardingLoading ||
    workersLoading ||
    locationsLoading ||
    configLoading ||
    settingsLoading ||
    pricingLoading ||
    orgLoading;

  // Only show if onboarding is completed and not dismissed
  if (!onboardingStatus?.completed || isDismissed || loading || !onboardingStatus?.data) {
    return null;
  }

  const onboardingData = onboardingStatus.data;

  const getSetupSteps = (): SetupStep[] => {
    const steps: SetupStep[] = [];

    // Step 1: Add Workers (if they have employees)
    if (onboardingData?.employee_count && onboardingData.employee_count !== "none") {
      const hasWorkers = workers.length > 0;
      steps.push({
        id: "workers",
        title: "Add Your Workers",
        description: "Add employees or contractors who will use the mobile app",
        href: "/dashboard/users",
        icon: Users,
        required: true,
        completed: hasWorkers,
      });
    }

    // Step 2: Add Locations (if they service locations)
    if (onboardingData?.has_locations) {
      const hasLocations = locations.length > 0;
      const groupsHint = onboardingData?.has_company_client_groups
        ? " Then group sites under companies or client groups if needed."
        : "";
      steps.push({
        id: "locations",
        title: "Add Customer Locations",
        description: `Set up the sites you return to regularly.${groupsHint}`,
        href: "/dashboard/locations",
        icon: MapPin,
        required: true,
        completed: hasLocations,
      });
    }

    // Step 3: Configure Mobile App (always)
    const hasFieldConfigs = fieldConfigs.length > 0;
    steps.push({
      id: "mobile-config",
      title: "Customize Mobile App Forms",
      description: "Configure the forms your workers will use in the mobile app",
      href: "/dashboard/mobile-config",
      icon: Smartphone,
      required: true,
      completed: hasFieldConfigs,
    });

    // Step 4: Configure Pricing (always required after fields)
    steps.push({
      id: "pricing",
      title: "Set Up Pricing",
      description:
        "Configure pricing for your fields, options, and services. Essential for invoicing.",
      href: "/dashboard/pricing",
      icon: DollarSign,
      required: true,
      completed: hasPricing,
    });

    // Step 5: Invoice Configuration (always required)
    steps.push({
      id: "invoice-config",
      title: "Configure Invoice Settings",
      description: "Upload your logo and set your currency in Organization Settings.",
      href: "/dashboard/settings?tab=organization",
      icon: FileText,
      required: true,
      completed: hasInvoiceConfig,
    });

    const showEmailDomainStep =
      Boolean(organizationId) &&
      settings?.custom_email_domain_enabled === true &&
      userRole === "admin";

    if (showEmailDomainStep) {
      const verified = !sendingDomainLoading && sendingDomainRow?.display_status === "verified";
      const completed = verified || emailDomainSkipped;
      steps.push({
        id: "email-domain",
        title: "Set Up Email Domain",
        description:
          "Use a custom domain for transactional email. DNS verification can take up to 48 hours depending on your provider.",
        href: "/dashboard/settings?tab=email",
        icon: Mail,
        required: false,
        completed,
        onSkip: completed ? undefined : handleSkipEmailDomain,
      });
    }

    // Step 6: Payment Setup (optional, can be done later)
    const hasStripe = !!settings?.stripe_account_id;
    steps.push({
      id: "payment",
      title: "Set Up Payment Processing",
      description: "Connect Stripe to accept payments from customers",
      href: "/dashboard/settings?tab=payment",
      icon: CreditCard,
      required: false,
      completed: hasStripe,
    });

    return steps;
  };

  const steps = getSetupSteps();
  const completedSteps = steps.filter((s) => s.completed).length;
  const requiredSteps = steps.filter((s) => s.required);
  const completedRequiredSteps = requiredSteps.filter((s) => s.completed).length;
  const allRequiredComplete = completedRequiredSteps === requiredSteps.length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 100;

  // Hide if all required steps are complete and dismissed
  if (allRequiredComplete && isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="shadow-lg border-2 border-primary/20">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                    {allRequiredComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">
                        {completedRequiredSteps}/{requiredSteps.length}
                      </span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Getting Started</CardTitle>
                    <CardDescription className="text-xs">
                      {allRequiredComplete
                        ? "All set! Optional steps remain"
                        : `${completedRequiredSteps} of ${requiredSteps.length} complete`}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDismissed(true);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-3">
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="rounded-md border border-transparent">
                    <Link
                      href={step.href}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <div className="shrink-0 mt-0.5">
                        {step.completed ? (
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium ${
                              step.completed ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            {step.title}
                          </p>
                          {!step.required && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                    </Link>
                    {step.onSkip ? (
                      <div className="pl-10 pr-2 pb-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => step.onSkip?.()}
                        >
                          Skip for now
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {allRequiredComplete && (
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setIsDismissed(true);
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
