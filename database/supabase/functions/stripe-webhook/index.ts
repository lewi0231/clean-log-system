import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createStripeClient } from "../_utils/stripe.ts";
import type { Stripe } from "../_utils/stripe.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { dispatchStripeEvent } from "./handlers/dispatch-stripe-event.ts";
import { ensureWebhookEventRecord } from "./handlers/ensure-webhook-event-record.ts";
import { markWebhookEventProcessed } from "./handlers/mark-webhook-event-processed.ts";
import { verifyStripeWebhookRequest } from "./handlers/verify-stripe-webhook-request.ts";

serve(async (req) => {
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let processedEvent: Stripe.Event | undefined;
  const supabase = createServiceRoleClient();
  const logger = createLogger(req, { functionName: "stripe-webhook" });

  try {
    const verified = await verifyStripeWebhookRequest(req, logger);
    if (verified instanceof Response) return verified;

    const event = verified.event;
    processedEvent = event;
    const stripe = createStripeClient();

    logger.info(`Processing Stripe webhook event: ${event.type}`, {
      event_id: event.id,
      type: event.type,
    });

    const duplicateResponse = await ensureWebhookEventRecord(supabase, event, logger);
    if (duplicateResponse) return duplicateResponse;

    await dispatchStripeEvent({ supabase, stripe, event, logger });

    await markWebhookEventProcessed(supabase, event.id, logger);

    return jsonResponse({ received: true });
  } catch (error) {
    logger.error("Webhook processing error", error);
    const errorMessage = error instanceof Error ? error.message : "Webhook processing failed";

    try {
      if (processedEvent?.id) {
        await supabase
          .from("webhook_event")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("event_id", processedEvent.id);
      }
    } catch (updateError) {
      logger.warn("Error updating webhook event status", {
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }

    return errorResponse(errorMessage, 500);
  }
});
