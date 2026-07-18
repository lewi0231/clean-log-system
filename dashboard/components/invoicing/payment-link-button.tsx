"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePaymentLink } from "@/hooks/use-payment-link";
import { log } from "@/lib/logger";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PaymentLinkButtonProps {
  invoiceId: string;
  disabled?: boolean;
  onLinkCreated?: (url: string) => void;
}

/**
 * Button component to generate and open Stripe payment link
 * Follows Next.js best practices with proper error handling and loading states
 */
export default function PaymentLinkButton({
  invoiceId,
  disabled = false,
  onLinkCreated,
}: PaymentLinkButtonProps) {
  const { paymentLink, loading, error, createPaymentLink } = usePaymentLink(invoiceId);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAndOpen = async () => {
    try {
      setIsCreating(true);
      log.info("Creating payment link", { invoiceId });

      // Determine success/cancel URLs based on current location
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/dashboard/invoicing?payment=success`;
      const cancelUrl = `${baseUrl}/dashboard/invoicing?payment=cancelled`;

      const link = await createPaymentLink(invoiceId, successUrl, cancelUrl);

      log.info("Payment link created", { paymentLinkId: link.id });

      // Open payment link in new tab
      window.open(link.url, "_blank", "noopener,noreferrer");

      // Notify parent if callback provided
      if (onLinkCreated) {
        onLinkCreated(link.url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log.error("Failed to create payment link", { error: msg });
      toast.error("Failed to create payment link", {
        description: msg,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenExisting = () => {
    if (paymentLink?.url) {
      window.open(paymentLink.url, "_blank", "noopener,noreferrer");
    }
  };

  // Show existing link if available and still open
  if (paymentLink && paymentLink.status === "open" && !loading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              onClick={handleOpenExisting}
              disabled={disabled}
              className="gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Open Payment Link
              <ExternalLink className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open existing payment link in new tab</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show create button
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            onClick={handleCreateAndOpen}
            disabled={disabled || loading || isCreating}
            className="gap-2"
          >
            {isCreating || loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Create Payment Link
              </>
            )}
          </Button>
        </TooltipTrigger>
        {error && (
          <TooltipContent>
            <p className="text-destructive">{error}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
