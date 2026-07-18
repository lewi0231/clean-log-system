"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { OrganizationSettings } from "@/lib/types";
import {
  WORKFORCE_ENGAGEMENT_DISCLAIMER,
  type WorkforceEngagement,
} from "@clean-log/shared/utils/workforce-engagement";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkforceEngagementSettingsCardProps {
  organizationId: string;
  value: WorkforceEngagement;
  onApplied: (settings: OrganizationSettings) => void;
}

export function WorkforceEngagementSettingsCard({
  organizationId,
  value,
  onApplied,
}: WorkforceEngagementSettingsCardProps) {
  const queryClient = useQueryClient();
  const [engagement, setEngagement] = useState<WorkforceEngagement>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEngagement(value);
  }, [value]);

  const persist = async (next: WorkforceEngagement) => {
    if (next === value) return;
    setSaving(true);
    try {
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        workforce_engagement: next,
      });
      if (data.settings) {
        onApplied(data.settings);
        void queryClient.invalidateQueries({ queryKey: organizationSettingsKey(organizationId) });
      }
      toast.success("Workforce engagement updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      log.warn("workforce engagement save failed", { error: msg });
      toast.error(msg);
      setEngagement(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Workforce engagement
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
        <CardDescription>
          How field workers settle amounts in Tally. Changing this does not delete existing
          contractor tax invoices. Changes save automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{WORKFORCE_ENGAGEMENT_DISCLAIMER}</p>
        <RadioGroup
          value={engagement}
          onValueChange={(v) => {
            const next = v as WorkforceEngagement;
            setEngagement(next);
            void persist(next);
          }}
          className="space-y-3"
          disabled={saving}
        >
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="employees" id="set-eng-employees" className="mt-1" />
            <Label htmlFor="set-eng-employees" className="font-normal cursor-pointer">
              <span className="font-medium">Employees</span>
              <span className="block text-xs text-muted-foreground">
                Calculate and record pay in Worker payments. No contractor tax invoices.
              </span>
            </Label>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="contractors" id="set-eng-contractors" className="mt-1" />
            <Label htmlFor="set-eng-contractors" className="font-normal cursor-pointer">
              <span className="font-medium">Contractors</span>
              <span className="block text-xs text-muted-foreground">
                Workers can submit tax invoices for approved jobs from the mobile app.
              </span>
            </Label>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="both" id="set-eng-both" className="mt-1" />
            <Label htmlFor="set-eng-both" className="font-normal cursor-pointer">
              <span className="font-medium">Both</span>
              <span className="block text-xs text-muted-foreground">
                Choose employee vs contractor per worker. Switching to Both leaves existing workers
                as employees until you edit them.
              </span>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
