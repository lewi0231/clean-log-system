"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import useOrganization from "@/hooks/useOrganization";
import {
  submitBetaFeedback,
  type BetaFeedbackCategory,
} from "@/lib/services/beta-feedback.service";
import { MessageSquarePlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORIES: { value: BetaFeedbackCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "idea", label: "Idea" },
  { value: "bug", label: "Bug" },
];

export function BetaFeedbackTrigger(): React.ReactElement {
  const { organizationId } = useOrganization();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BetaFeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pagePath = pathname ?? undefined;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!organizationId || !message.trim()) {
      toast.error("Please enter your feedback.");
      return;
    }
    setSubmitting(true);
    try {
      await submitBetaFeedback({
        organization_id: organizationId,
        message: message.trim(),
        category,
        page_path: pagePath,
      });
      toast.success("Thanks! Your feedback has been sent.");
      setMessage("");
      setCategory("general");
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to send feedback.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
        >
          <MessageSquarePlus className="h-5 w-5" />
          <span className="font-medium text-sm">Send feedback</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Send feedback</SheetTitle>
          <SheetDescription>
            We’re in beta. Tell us what’s working, what’s not, or share an idea.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 pt-6"
        >
          <div className="space-y-2">
            <Label htmlFor="beta-feedback-category">Type (optional)</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as BetaFeedbackCategory)}
            >
              <SelectTrigger id="beta-feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <Label htmlFor="beta-feedback-message">Your feedback *</Label>
            <Textarea
              id="beta-feedback-message"
              placeholder="What’s on your mind?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={5000}
              className="resize-none"
              required
            />
          </div>
          {pagePath ? (
            <p className="text-xs text-muted-foreground">
              Where: <code className="rounded bg-muted px-1">{pagePath}</code>
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            data-testid="beta-feedback-submit"
          >
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
