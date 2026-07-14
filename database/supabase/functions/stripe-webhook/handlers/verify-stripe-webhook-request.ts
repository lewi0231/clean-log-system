import { errorResponse } from "../../_utils/http.ts";
import { createLogger } from "../../_utils/logger.ts";
import { getStripeWebhookSecret, verifyWebhookSignature } from "../../_utils/stripe.ts";
import type { Stripe } from "../../_utils/stripe.ts";

type WebhookLogger = ReturnType<typeof createLogger>;

/**
 * Single read of raw body + signature verification. Returns a Response on failure.
 */
export async function verifyStripeWebhookRequest(
  req: Request,
  logger: WebhookLogger
): Promise<Response | { event: Stripe.Event }> {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return errorResponse("Missing Stripe-Signature header", 400);
  }

  try {
    const webhookSecret = getStripeWebhookSecret();
    const event = verifyWebhookSignature(body, signature, webhookSecret);
    return { event };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("Webhook signature verification failed", err, {
      hint: "For local dev: Use webhook secret from 'stripe listen' output. Disable remote webhook endpoints in Stripe Dashboard.",
    });
    return errorResponse(`Webhook signature verification failed: ${errorMessage}`, 400);
  }
}
