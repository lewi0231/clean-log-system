import { createLogger } from "../../_utils/logger.ts";
import { createServiceRoleClient } from "../../_utils/supabase.ts";

type WebhookLogger = ReturnType<typeof createLogger>;
type ServiceSupabase = ReturnType<typeof createServiceRoleClient>;

/** Best-effort: set processed_at after handler dispatch succeeds. */
export async function markWebhookEventProcessed(
  supabase: ServiceSupabase,
  eventId: string,
  logger: WebhookLogger
): Promise<void> {
  const { error } = await supabase
    .from("webhook_event")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  if (error) {
    logger.warn("Error updating webhook event status", { error: error.message });
  }
}
