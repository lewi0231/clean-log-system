"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import useOrganization from "@/hooks/useOrganization";
import { CreditCard, MapPin, Smartphone, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
}

export default function GuidedSetupPage() {
  const router = useRouter();
  const { loading: orgLoading } = useOrganization();
  const { onboardingStatus, loading: onboardingLoading } = useOnboardingStatus();

  const loading = orgLoading || onboardingLoading;
  const onboardingData = onboardingStatus?.data || null;

  const getSetupSteps = (): SetupStep[] => {
    const steps: SetupStep[] = [];

    // Step 1: Add Workers (if they have employees)
    if (onboardingData?.employee_count && onboardingData.employee_count !== "none") {
      steps.push({
        id: "workers",
        title: "Add Your Workers",
        description: "Add employees or contractors who will use the mobile app",
        href: "/dashboard/users",
        icon: Users,
        required: true,
      });
    }

    // Step 2: Add Locations (if they service locations)
    if (onboardingData?.has_locations) {
      steps.push({
        id: "locations",
        title: "Add Customer Locations",
        description: "Set up your customer locations for recurring jobs",
        href: "/dashboard/locations",
        icon: MapPin,
        required: true,
      });
    }

    // Step 3: Configure Mobile App (always)
    steps.push({
      id: "mobile-config",
      title: "Customize Mobile App Forms",
      description: "Configure the forms your workers will use in the mobile app",
      href: "/dashboard/mobile-config",
      icon: Smartphone,
      required: true,
    });

    // Step 4: Payment Setup (optional, can be done later)
    steps.push({
      id: "payment",
      title: "Set Up Payment Processing",
      description: "Connect Stripe to accept payments from customers",
      href: "/dashboard/settings?tab=payment",
      icon: CreditCard,
      required: false,
    });

    return steps;
  };

  const handleCompleteSetup = async () => {
    router.push("/dashboard");
  };

  if (loading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading setup guide...</p>
      </div>
    );
  }

  const steps = getSetupSteps();
  const requiredSteps = steps.filter((s) => s.required);
  const optionalSteps = steps.filter((s) => !s.required);

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Let&apos;s Get You Set Up</h1>
        <p className="text-muted-foreground">
          Complete these steps to start using Tally Runner. You can always come back to finish
          later.
        </p>
      </div>

      <div className="space-y-6">
        {/* Required Steps */}
        {requiredSteps.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Required Setup</h2>
            <div className="space-y-4">
              {requiredSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card key={step.id} className="relative">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-1">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{step.title}</CardTitle>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              Step {index + 1}
                            </span>
                          </div>
                          <CardDescription>{step.description}</CardDescription>
                        </div>
                        <div className="shrink-0">
                          <Button asChild>
                            <Link href={step.href}>Get Started</Link>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Steps */}
        {optionalSteps.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Optional Setup</h2>
            <div className="space-y-4">
              {optionalSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <Card key={step.id} className="relative">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-1">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{step.title}</CardTitle>
                          <CardDescription>{step.description}</CardDescription>
                        </div>
                        <div className="shrink-0">
                          <Button variant="outline" asChild>
                            <Link href={step.href}>Set Up Later</Link>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Complete Setup Button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium mb-1">Ready to continue?</p>
                <p className="text-sm text-muted-foreground">
                  You can always come back to complete these steps later from your dashboard.
                </p>
              </div>
              <Button onClick={handleCompleteSetup} size="lg">
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
