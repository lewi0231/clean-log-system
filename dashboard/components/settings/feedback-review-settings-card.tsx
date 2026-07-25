"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_FEEDBACK_EMAIL_BODY,
  DEFAULT_FEEDBACK_EMAIL_SUBJECT,
  FEEDBACK_EMAIL_PLACEHOLDERS,
  type FeedbackRequestMode,
} from "@/lib/constants/feedback-email";
import { getRatingConfigPreset, RATING_DIMENSION_LABELS } from "@/lib/constants/rating-config";
import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { OrganizationSettings, RatingConfigType } from "@/lib/types";
import { ExternalLink, Eye, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  organizationId: string;
  isAdmin: boolean;
  settings: OrganizationSettings;
  onSettingsPatch: (patch: Partial<OrganizationSettings>) => void;
  onError: (title: string, message: string) => void;
  onInvalidate: () => void;
};

async function persistFeedbackSettings(
  organizationId: string,
  patch: Partial<OrganizationSettings>
): Promise<OrganizationSettings> {
  const data = await invokeTypedEdge("update-organization-settings", {
    organization_id: organizationId,
    ...patch,
  });
  return data.settings;
}

export function FeedbackReviewSettingsCard({
  organizationId,
  isAdmin,
  settings,
  onSettingsPatch,
  onError,
  onInvalidate,
}: Props) {
  const mode = settings.feedback_request_mode ?? "internal";
  const enabled = settings.feedback_requests_enabled ?? true;
  // Always show URL field so admins can enter https:// before switching to Public/Both
  // (hiding it until mode≠internal created a chicken-and-egg dead end).
  const ratingDisabled = mode === "public";
  const publicUrlRequired = mode === "public" || mode === "both";

  const [publicUrlDraft, setPublicUrlDraft] = useState(settings.public_review_url ?? "");
  const [replyToDraft, setReplyToDraft] = useState(settings.feedback_email_reply_to ?? "");
  const [subjectDraft, setSubjectDraft] = useState(
    settings.feedback_email_subject ?? DEFAULT_FEEDBACK_EMAIL_SUBJECT
  );
  const [bodyDraft, setBodyDraft] = useState(
    settings.feedback_email_body ?? DEFAULT_FEEDBACK_EMAIL_BODY
  );
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [savingReplyTo, setSavingReplyTo] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setPublicUrlDraft(settings.public_review_url ?? "");
  }, [settings.public_review_url]);

  useEffect(() => {
    setReplyToDraft(settings.feedback_email_reply_to ?? "");
  }, [settings.feedback_email_reply_to]);

  useEffect(() => {
    setSubjectDraft(settings.feedback_email_subject ?? DEFAULT_FEEDBACK_EMAIL_SUBJECT);
  }, [settings.feedback_email_subject]);

  useEffect(() => {
    setBodyDraft(settings.feedback_email_body ?? DEFAULT_FEEDBACK_EMAIL_BODY);
  }, [settings.feedback_email_body]);

  const previewText = useMemo(() => {
    const sample: Record<string, string> = {
      organization_name: settings.name || "Your Company",
      location_name: "Sample Location",
      location_suffix: " at Sample Location",
      job_date: new Date().toLocaleDateString(settings.locale || "en-AU"),
      contact_name: "Alex",
      internal_review_url: "https://example.com/review/sample-token",
      public_review_url: publicUrlDraft || "https://g.page/r/sample",
      cta_block: "[Review button]",
    };
    const apply = (template: string) =>
      template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => sample[key] ?? "");
    return {
      subject: apply(subjectDraft),
      body: apply(bodyDraft),
    };
  }, [bodyDraft, publicUrlDraft, settings.locale, settings.name, subjectDraft]);

  const runUpdate = async (
    patch: Partial<OrganizationSettings>,
    successMessage: string,
    rollback?: () => void
  ) => {
    if (!isAdmin) {
      onError("Admin required", "Only organization admins can change feedback settings.");
      rollback?.();
      return;
    }
    try {
      const updated = await persistFeedbackSettings(organizationId, patch);
      // Merge only keys we intended to change (+ server-normalized values for those keys).
      // Avoid replacing the whole settings object if the API omits unrelated fields.
      const merged: Partial<OrganizationSettings> = { ...patch };
      for (const key of Object.keys(patch) as (keyof OrganizationSettings)[]) {
        if (updated && updated[key] !== undefined) {
          (merged as Record<string, unknown>)[key] = updated[key];
        }
      }
      onSettingsPatch(merged);
      onInvalidate();
      toast.success(successMessage);
    } catch (err) {
      rollback?.();
      log.error("Feedback settings update failed", {
        error: err instanceof Error ? err.message : err,
      });
      onError(
        "Update Failed",
        err instanceof Error ? err.message : "Failed to update feedback settings."
      );
    }
  };

  const handleMasterToggle = async (checked: boolean) => {
    const previous = enabled;
    onSettingsPatch({ feedback_requests_enabled: checked });
    await runUpdate(
      { feedback_requests_enabled: checked },
      checked ? "Feedback requests enabled" : "Feedback requests disabled",
      () => onSettingsPatch({ feedback_requests_enabled: previous })
    );
  };

  const handleAutoSendToggle = async (checked: boolean) => {
    const previous = settings.feedback_auto_send ?? false;
    onSettingsPatch({ feedback_auto_send: checked });
    await runUpdate(
      { feedback_auto_send: checked },
      checked ? "Auto-send enabled" : "Auto-send disabled",
      () => onSettingsPatch({ feedback_auto_send: previous })
    );
  };

  const handleDelayChange = async (value: string) => {
    const hours = parseInt(value, 10);
    const previous = settings.feedback_send_delay_hours ?? 0;
    onSettingsPatch({ feedback_send_delay_hours: hours });
    await runUpdate({ feedback_send_delay_hours: hours }, "Send delay updated", () =>
      onSettingsPatch({ feedback_send_delay_hours: previous })
    );
  };

  const handleModeChange = async (next: FeedbackRequestMode) => {
    if (next === mode) return;
    const previous = mode;
    const previousUrl = settings.public_review_url;
    const draftUrl = publicUrlDraft.trim();
    const needsPublicUrl = next === "public" || next === "both";
    const effectiveUrl = draftUrl || settings.public_review_url?.trim() || "";

    if (needsPublicUrl && !effectiveUrl) {
      onError(
        "Public review URL required",
        "Add a Google (or other) https:// review link before selecting Public or Both."
      );
      return;
    }
    if (needsPublicUrl && !/^https:\/\//i.test(effectiveUrl)) {
      onError("Invalid URL", "Public review URL must start with https://");
      return;
    }

    const patch: Partial<OrganizationSettings> = { feedback_request_mode: next };
    // Persist unsaved URL draft with the mode change so server validation succeeds
    if (needsPublicUrl && draftUrl && draftUrl !== (settings.public_review_url ?? "")) {
      patch.public_review_url = draftUrl;
    }

    onSettingsPatch(patch);
    await runUpdate(patch, "Feedback destination updated", () =>
      onSettingsPatch({
        feedback_request_mode: previous,
        public_review_url: previousUrl,
      })
    );
  };

  const handleSavePublicUrl = async () => {
    const trimmed = publicUrlDraft.trim();
    if (trimmed && !/^https:\/\//i.test(trimmed)) {
      onError("Invalid URL", "Public review URL must start with https://");
      return;
    }
    if (publicUrlRequired && !trimmed) {
      onError("Public review URL required", "URL is required for Public or Both destination.");
      return;
    }
    setSavingUrl(true);
    try {
      await runUpdate({ public_review_url: trimmed || null }, "Public review URL saved");
    } finally {
      setSavingUrl(false);
    }
  };

  const handleSaveReplyTo = async () => {
    const trimmed = replyToDraft.trim();
    setSavingReplyTo(true);
    try {
      await runUpdate({ feedback_email_reply_to: trimmed || null }, "Reply-To updated");
    } finally {
      setSavingReplyTo(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (subjectDraft.trim().length > 200) {
      onError("Subject too long", "Subject must be 200 characters or fewer.");
      return;
    }
    if (bodyDraft.length > 10_000) {
      onError("Body too long", "Body must be 10,000 characters or fewer.");
      return;
    }
    setSavingTemplate(true);
    try {
      await runUpdate(
        {
          feedback_email_subject: subjectDraft.trim() || null,
          feedback_email_body: bodyDraft.trim() || null,
        },
        "Email template saved"
      );
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = () => {
    setSubjectDraft(DEFAULT_FEEDBACK_EMAIL_SUBJECT);
    setBodyDraft(DEFAULT_FEEDBACK_EMAIL_BODY);
  };

  const handleRatingConfigChange = async (value: string) => {
    if (ratingDisabled) return;
    const newType = value as RatingConfigType;
    const newConfig = getRatingConfigPreset(newType);
    const previous = settings.rating_config;
    onSettingsPatch({ rating_config: newConfig });
    await runUpdate({ rating_config: newConfig }, "Rating configuration updated", () =>
      onSettingsPatch({ rating_config: previous })
    );
  };

  const handleSendTest = async () => {
    if (!isAdmin) {
      onError("Admin required", "Only organization admins can send a test feedback email.");
      return;
    }
    setSendingTest(true);
    try {
      const result = await invokeTypedEdge("send-feedback-test-email", {
        organization_id: organizationId,
      });
      if (result.skipped) {
        toast.message("Test email skipped (email sending disabled in this environment)", {
          description: `Would send to ${result.to}`,
        });
      } else {
        toast.success(`Test email sent to ${result.to}`, {
          description:
            "Internal review links in test emails are sample URLs and will not open a real job.",
        });
      }
    } catch (err) {
      log.error("Feedback test email failed", {
        error: err instanceof Error ? err.message : err,
      });
      onError(
        "Test email failed",
        err instanceof Error ? err.message : "Could not send test feedback email."
      );
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div>
        <h3 className="text-base font-semibold">Feedback & review requests</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose whether customers leave private ratings, a public review (e.g. Google), or both.
        </p>
      </div>

      {!isAdmin && (
        <Alert>
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>
            Only organization admins can change feedback request settings.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertTitle>Already-sent emails keep their original links</AlertTitle>
        <AlertDescription>
          Changing destination or URL here applies to new sends. Landing pages for previously sent
          links use the settings that were active when that email was sent.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="feedback-requests-enabled" className="text-base font-semibold">
            Enable feedback requests
          </Label>
          <p className="text-sm text-muted-foreground">
            Master switch. When off, no feedback emails are queued or sent.
          </p>
        </div>
        <Switch
          id="feedback-requests-enabled"
          checked={enabled}
          disabled={!isAdmin}
          onCheckedChange={handleMasterToggle}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="feedback-auto-send" className="text-base font-semibold">
            Automatically send feedback requests
          </Label>
          <p className="text-sm text-muted-foreground">
            {settings.feedback_auto_send
              ? "Emails are queued after a job is completed (after any delay and edit window)"
              : "Feedback emails require manual action to send"}
          </p>
        </div>
        <Switch
          id="feedback-auto-send"
          checked={settings.feedback_auto_send ?? false}
          disabled={!isAdmin || !enabled}
          onCheckedChange={handleAutoSendToggle}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-send-delay" className="text-base font-semibold">
          Send delay
        </Label>
        <p className="text-sm text-muted-foreground">
          Hours after job completion before auto-send (0–168). The job edit window still applies —
          emails wait until workers can no longer withdraw the job.
        </p>
        <Select
          value={String(settings.feedback_send_delay_hours ?? 0)}
          onValueChange={handleDelayChange}
          disabled={!isAdmin || !enabled}
        >
          <SelectTrigger id="feedback-send-delay" className="w-[220px]">
            <SelectValue placeholder="Select delay" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">No delay (default)</SelectItem>
            <SelectItem value="1">1 hour</SelectItem>
            <SelectItem value="2">2 hours</SelectItem>
            <SelectItem value="6">6 hours</SelectItem>
            <SelectItem value="12">12 hours</SelectItem>
            <SelectItem value="24">24 hours</SelectItem>
            <SelectItem value="48">48 hours</SelectItem>
            <SelectItem value="72">72 hours</SelectItem>
            <SelectItem value="168">1 week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold">Destination</Label>
        <p className="text-sm text-muted-foreground">
          Asking for public reviews (Google, Facebook, etc.) may create compliance obligations.
          Confirm this matches your policies.
        </p>
        <RadioGroup
          value={mode}
          onValueChange={(v) => void handleModeChange(v as FeedbackRequestMode)}
          disabled={!isAdmin || !enabled}
          className="space-y-2"
        >
          <div className="flex items-start space-x-2 rounded-md border p-3">
            <RadioGroupItem value="internal" id="mode-internal" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="mode-internal" className="font-normal cursor-pointer">
                Internal ratings only
              </Label>
              <p className="text-sm text-muted-foreground">
                Private form in Tally Runner (appears on Ratings).
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 rounded-md border p-3">
            <RadioGroupItem value="public" id="mode-public" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="mode-public" className="font-normal cursor-pointer">
                Public review only
              </Label>
              <p className="text-sm text-muted-foreground">
                Send customers straight to your Google (or other) review link.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 rounded-md border p-3">
            <RadioGroupItem value="both" id="mode-both" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="mode-both" className="font-normal cursor-pointer">
                Both
              </Label>
              <p className="text-sm text-muted-foreground">
                Landing page offers private feedback and a public review as equal choices.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="public-review-url" className="text-base font-semibold">
          Google review link (or other public review URL)
          {publicUrlRequired ? " *" : ""}
        </Label>
        <p className="text-sm text-muted-foreground">
          Must be an https:// URL. Required when destination is Public or Both — enter it here
          before changing destination if needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="public-review-url"
            value={publicUrlDraft}
            onChange={(e) => setPublicUrlDraft(e.target.value)}
            placeholder="https://g.page/r/…"
            disabled={!isAdmin || !enabled}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!isAdmin || !enabled || savingUrl}
              onClick={() => void handleSavePublicUrl()}
            >
              {savingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save URL"}
            </Button>
            {publicUrlDraft.trim() && /^https:\/\//i.test(publicUrlDraft.trim()) && (
              <Button type="button" variant="outline" asChild>
                <a href={publicUrlDraft.trim()} target="_blank" rel="noopener noreferrer">
                  Open link
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-reply-to" className="text-base font-semibold">
          Reply-To (optional)
        </Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="feedback-reply-to"
            type="email"
            value={replyToDraft}
            onChange={(e) => setReplyToDraft(e.target.value)}
            placeholder="ops@yourcompany.com"
            disabled={!isAdmin || !enabled}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!isAdmin || !enabled || savingReplyTo}
            onClick={() => void handleSaveReplyTo()}
          >
            {savingReplyTo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-subject" className="text-base font-semibold">
          Email subject & body
        </Label>
        <p className="text-sm text-muted-foreground">
          Placeholders: {FEEDBACK_EMAIL_PLACEHOLDERS.join(", ")}
        </p>
        <Input
          id="feedback-subject"
          value={subjectDraft}
          onChange={(e) => setSubjectDraft(e.target.value)}
          disabled={!isAdmin || !enabled}
          maxLength={200}
        />
        <Textarea
          value={bodyDraft}
          onChange={(e) => setBodyDraft(e.target.value)}
          disabled={!isAdmin || !enabled}
          rows={10}
          className="font-mono text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!isAdmin || !enabled || savingTemplate}
            onClick={() => void handleSaveTemplate()}
          >
            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save template"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isAdmin || !enabled}
            onClick={handleResetTemplate}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset defaults
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="h-4 w-4 mr-1" />
            {showPreview ? "Hide preview" : "Preview"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isAdmin || !enabled || sendingTest}
            onClick={() => void handleSendTest()}
          >
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test email"}
          </Button>
        </div>
        {showPreview && (
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <p className="text-sm font-medium">Subject: {previewText.subject}</p>
            <pre className="text-sm whitespace-pre-wrap font-sans">{previewText.body}</pre>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Recipients use the same rules as invoice emails. Mute individual sites under{" "}
        <Link href="/dashboard/locations" className="text-primary hover:underline">
          Locations
        </Link>
        .
      </p>

      <Link
        href="/dashboard/ratings"
        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
      >
        View customer ratings
        <ExternalLink className="h-3 w-3" />
      </Link>

      <div className="space-y-2 pt-2 border-t">
        <Label className="text-base font-semibold">Rating Configuration</Label>
        <p className="text-sm text-muted-foreground">
          Shape of the private (internal) rating form.
          {ratingDisabled
            ? " Disabled while destination is Public review only — Ratings charts won’t fill from that path."
            : " Based on industry best practices."}
        </p>
        {ratingDisabled && (
          <Alert>
            <AlertDescription>
              Public-only mode sends customers to your external review link. Switch to Internal or
              Both to collect private ratings in Tally Runner.
            </AlertDescription>
          </Alert>
        )}
        <RadioGroup
          value={settings.rating_config?.type ?? "single"}
          onValueChange={(v) => void handleRatingConfigChange(v)}
          disabled={!isAdmin || ratingDisabled}
        >
          <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
            <RadioGroupItem value="single" id="rating-single" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="rating-single" className="font-normal cursor-pointer">
                Single Overall Rating
              </Label>
              <p className="text-sm text-muted-foreground">
                Customers provide one overall satisfaction rating (1-5 stars). Simple and quick.
              </p>
              <div className="text-xs text-muted-foreground mt-1">
                Dimensions: Overall Satisfaction
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
            <RadioGroupItem value="three_dimensions" id="rating-three" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="rating-three" className="font-normal cursor-pointer">
                Three Dimensions
              </Label>
              <p className="text-sm text-muted-foreground">
                Customers rate Service Quality, Communication, and Value for Money. Recommended for
                most service businesses.
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
            <RadioGroupItem value="rater" id="rating-rater" className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor="rating-rater" className="font-normal cursor-pointer">
                Full RATER Framework
              </Label>
              <p className="text-sm text-muted-foreground">
                Comprehensive 5-dimension rating system: Reliability, Assurance, Tangibles, Empathy,
                and Responsiveness. Best for detailed feedback analysis.
              </p>
              <div className="text-xs text-muted-foreground mt-1">
                Dimensions:{" "}
                {["reliability", "assurance", "tangibles", "empathy", "responsiveness"]
                  .map((d) => RATING_DIMENSION_LABELS[d])
                  .join(", ")}
              </div>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
