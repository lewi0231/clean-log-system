// Stripe utilities for Edge Functions
// Provides Stripe client initialization and helper functions

import Stripe from "stripe";

export type { Stripe };

/**
 * Get Stripe secret key from environment variables
 */
function getStripeSecretKey(): string {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!secretKey || secretKey === "null" || secretKey === "undefined") {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Please set it in your environment variables.",
    );
  }

  return secretKey;
}

/**
 * Get Stripe webhook secret from environment variables
 */
export function getStripeWebhookSecret(): string {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (
    !webhookSecret || webhookSecret === "null" || webhookSecret === "undefined"
  ) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Please set it in your environment variables.",
    );
  }

  return webhookSecret;
}

/**
 * Create and return a Stripe client instance
 */
export function createStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
}

/**
 * Verify webhook signature from Stripe
 * @param payload - Raw request body as string
 * @param signature - Stripe-Signature header value
 * @param secret - Webhook signing secret
 * @returns Stripe Event object
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = createStripeClient();

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return event;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}
