/**
 * Tests for Stripe utility functions
 *
 * Run with: deno test --allow-all functions/__tests__/stripe-utils.test.ts
 */

import { assertThrows } from "@std/assert";

Deno.test("getStripeWebhookSecret should throw if STRIPE_WEBHOOK_SECRET is not set", async () => {
  // Save original value
  const original = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  // Remove the env var
  Deno.env.delete("STRIPE_WEBHOOK_SECRET");

  // Import after env change
  const { getStripeWebhookSecret } = await import("../_utils/stripe.ts");

  // Should throw error
  assertThrows(
    () => getStripeWebhookSecret(),
    Error,
    "STRIPE_WEBHOOK_SECRET is not set",
  );

  // Restore original value
  if (original) {
    Deno.env.set("STRIPE_WEBHOOK_SECRET", original);
  }
});

Deno.test("getStripeWebhookSecret should throw if STRIPE_WEBHOOK_SECRET is 'null'", async () => {
  const original = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  Deno.env.set("STRIPE_WEBHOOK_SECRET", "null");

  const { getStripeWebhookSecret } = await import("../_utils/stripe.ts");

  assertThrows(
    () => getStripeWebhookSecret(),
    Error,
    "STRIPE_WEBHOOK_SECRET is not set",
  );

  if (original) {
    Deno.env.set("STRIPE_WEBHOOK_SECRET", original);
  }
});

Deno.test("createStripeClient should throw if STRIPE_SECRET_KEY is not set", async () => {
  const original = Deno.env.get("STRIPE_SECRET_KEY");

  Deno.env.delete("STRIPE_SECRET_KEY");

  const { createStripeClient } = await import("../_utils/stripe.ts");

  assertThrows(
    () => createStripeClient(),
    Error,
    "STRIPE_SECRET_KEY is not set",
  );

  if (original) {
    Deno.env.set("STRIPE_SECRET_KEY", original);
  }
});

Deno.test("verifyWebhookSignature should throw on invalid signature", async () => {
  // Set a dummy secret key for Stripe client initialization
  const originalSecret = Deno.env.get("STRIPE_SECRET_KEY");
  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy_key_for_testing");

  const { verifyWebhookSignature } = await import("../_utils/stripe.ts");

  const payload = '{"type":"checkout.session.completed","id":"evt_test"}';
  const invalidSignature = "invalid_signature";
  const secret = "whsec_test_secret";

  assertThrows(
    () => verifyWebhookSignature(payload, invalidSignature, secret),
    Error,
    "Webhook signature verification failed",
  );

  // Restore original
  if (originalSecret) {
    Deno.env.set("STRIPE_SECRET_KEY", originalSecret);
  } else {
    Deno.env.delete("STRIPE_SECRET_KEY");
  }
});
