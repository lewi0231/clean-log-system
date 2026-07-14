"use client";

import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import Link from "next/link";

export function InvoiceAdjustmentsGstHint() {
  const { settings, loading } = useOrganizationSettings();

  if (loading) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground mb-4">
        Loading tax settings…
      </div>
    );
  }

  if (!settings) return null;

  const taxLabel = settings.gst_registered
    ? `GST ${settings.gst_rate_percent}% (${settings.gst_inclusive ? "inclusive" : "exclusive"})`
    : "GST not registered";

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-3 mb-4">
      <span className="text-muted-foreground">
        Tax: <span className="font-medium text-foreground">{taxLabel}</span>
      </span>
      <Link
        href="/dashboard/settings#tax-gst"
        className="text-primary text-xs hover:underline shrink-0"
      >
        Edit in Settings →
      </Link>
    </div>
  );
}
