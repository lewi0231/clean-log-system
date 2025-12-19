"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import RatingsList from "@/components/ratings/ratings-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  PageHeaderSkeleton,
  RatingsSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { useFeedback } from "@/hooks/use-feedback";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";
import {
  getRatingConfigPreset,
  RATING_DIMENSION_LABELS,
} from "@/lib/constants/rating-config";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { RatingConfigType } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Settings } from "lucide-react";
import { useState } from "react";

export default function RatingsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const queryClient = useQueryClient();
  const { feedback, loading, error } = useFeedback();
  const [ratingSettingsOpen, setRatingSettingsOpen] = useState(false);

  const handleFeedbackEmailSendImmediatelyChange = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Ratings: Updating feedback email send immediately setting", {
        checked,
      });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            feedback_email_send_immediately: checked,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      // Invalidate settings query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });

      log.info(
        "Ratings: Feedback email send immediately setting updated successfully"
      );
    } catch (err) {
      log.error(
        "Ratings: Failed to update feedback email send immediately setting",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      alert("Failed to update setting. Please try again.");
    }
  };

  const handleRatingConfigChange = async (value: string) => {
    const newType = value as RatingConfigType;
    const newConfig = getRatingConfigPreset(newType);

    if (!organizationId) return;

    try {
      log.info("Ratings: Updating rating configuration", {
        type: newType,
        dimensions: newConfig.dimensions,
      });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            rating_config: newConfig,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      // Invalidate settings query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });

      log.info("Ratings: Rating configuration updated successfully");
    } catch (err) {
      log.error("Ratings: Failed to update rating configuration", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to update setting. Please try again.");
    }
  };

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <RatingsSkeleton />
      </>
    );
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Customer Ratings</h1>
        <p className="text-muted-foreground mt-2">
          View and manage customer feedback and ratings
        </p>
      </div>

      {/* Feedback & Rating Settings */}
      <Collapsible
        open={ratingSettingsOpen}
        onOpenChange={setRatingSettingsOpen}
        className="mb-6"
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle>Feedback & Rating Settings</CardTitle>
                    <CardDescription className="mt-1">
                      Configure how feedback requests are sent and how customers
                      rate your service
                    </CardDescription>
                  </div>
                </div>
                {ratingSettingsOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Feedback Email Settings */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="feedback-email-send-immediately">
                    Send Feedback Requests Immediately
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {settings?.feedback_email_send_immediately
                      ? "Feedback request emails will be sent to customers immediately after a job is completed"
                      : "Feedback request emails will require manual action to send"}
                  </p>
                </div>
                <Switch
                  id="feedback-email-send-immediately"
                  checked={settings?.feedback_email_send_immediately ?? false}
                  onCheckedChange={handleFeedbackEmailSendImmediatelyChange}
                  disabled={settingsLoading}
                />
              </div>

              <Separator />

              {/* Rating Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Rating Configuration</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose how customers rate your service. Based on industry
                    best practices.
                  </p>
                </div>
                <RadioGroup
                  value={settings?.rating_config?.type ?? "single"}
                  onValueChange={handleRatingConfigChange}
                >
                  <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                    <RadioGroupItem
                      value="single"
                      id="rating-single"
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="rating-single"
                        className="font-normal cursor-pointer"
                      >
                        Single Overall Rating
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Customers provide one overall satisfaction rating (1-5
                        stars). Simple and quick.
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dimensions: Overall Satisfaction
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                    <RadioGroupItem
                      value="three_dimensions"
                      id="rating-three"
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="rating-three"
                        className="font-normal cursor-pointer"
                      >
                        Three Dimensions
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Customers rate Service Quality, Communication, and Value
                        for Money. Recommended for most service businesses.
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dimensions:{" "}
                        {["quality", "communication", "value"]
                          .map((d) => RATING_DIMENSION_LABELS[d])
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                    <RadioGroupItem
                      value="rater"
                      id="rating-rater"
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="rating-rater"
                        className="font-normal cursor-pointer"
                      >
                        Full RATER Framework
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Comprehensive 5-dimension rating system: Reliability,
                        Assurance, Tangibles, Empathy, and Responsiveness. Best
                        for detailed feedback analysis.
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dimensions:{" "}
                        {[
                          "reliability",
                          "assurance",
                          "tangibles",
                          "empathy",
                          "responsiveness",
                        ]
                          .map((d) => RATING_DIMENSION_LABELS[d])
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="space-y-4">
        <RatingsList feedback={feedback} loading={loading} error={error} />
      </div>
    </>
  );
}
