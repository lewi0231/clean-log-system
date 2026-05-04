import { jsonResponse } from "../../_utils/http.ts";
import { createLogger } from "../../_utils/logger.ts";
import type { Stripe } from "../../_utils/stripe.ts";
import { createServiceRoleClient } from "../../_utils/supabase.ts";

type WebhookLogger = ReturnType<typeof createLogger>;
type ServiceSupabase = ReturnType<typeof createServiceRoleClient>;

/**
 * Idempotency: skip duplicate Stripe event IDs; insert processing row when new.
 * Returns an HTTP Response when the event was already processed (Stripe should not retry).
 */
export async function ensureWebhookEventRecord(
  supabase: ServiceSupabase,
  event: Stripe.Event,
  logger: WebhookLogger
): Promise<Response | undefined> {
  const { data: existingEvent, error: checkError } = await supabase
    .from("webhook_event")
    .select("id, status, processed_at")
    .eq("event_id", event.id)
    .maybeSingle();

  if (checkError) {
    logger.error("Error checking webhook event idempotency", checkError);
  } else if (existingEvent) {
    logger.info(`Webhook event ${event.id} already processed`, {
      status: existingEvent.status,
      processed_at: existingEvent.processed_at,
    });
    return jsonResponse({
      received: true,
      message: "Event already processed",
      event_id: event.id,
    });
  }

  const { error: insertError } = await supabase.from("webhook_event").insert({
    event_id: event.id,
    event_type: event.type,
    status: "processed",
    metadata: {
      livemode: event.livemode,
      api_version: event.api_version,
    },
  });

  if (insertError) {
    logger.error("Error recording webhook event", insertError);
  }

  return undefined;
}
