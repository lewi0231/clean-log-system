"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { formatPayPeriodBannerLine } from "@/lib/worker-payments/org-pay-period";
import { CalendarRange, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export function PayPeriodSummaryBanner() {
  const { settings } = useOrganizationSettings();
  const payPeriodBanner = useMemo(
    () => formatPayPeriodBannerLine(settings?.worker_payment_cycle_config ?? null, {}),
    [settings?.worker_payment_cycle_config]
  );

  return (
    <Alert className="border-muted bg-muted/30">
      <CalendarRange className="h-4 w-4" />
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span>
          <span className="font-medium text-foreground">Current pay period: </span>
          {payPeriodBanner.line}
          {payPeriodBanner.mode === "fallback" && (
            <span className="text-muted-foreground">
              {" "}
              (calendar month in your local timezone. Configure pay period in Settings.)
            </span>
          )}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings?tab=payment#worker-pay-period">
            <Settings2 className="mr-2 h-4 w-4" />
            Configure
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
