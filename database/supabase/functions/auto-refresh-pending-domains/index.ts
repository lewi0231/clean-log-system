import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLoggerWithoutRequest } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { resendHeaders, toDisplayStatus } from "../_utils/org-sending-domain-edge.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

await loadEnvIfLocal();

// auto-refresh-pending-domains
//
// Scheduled function that runs periodically (e.g. every 4 hours) to check
// pending domain verifications with Resend. When a domain becomes verified,
// creates a notification for org admins.
//
// Cron setup example (in Supabase SQL Editor):
//
// SELECT cron.schedule(
//   'auto-refresh-pending-domains',
//   '0 0,4,8,12,16,20 * * *',
//   $$ SELECT extensions.http_post(
//        'https://<project-ref>.supabase.co/functions/v1/auto-refresh-pending-domains',
//        '{}',
//        'application/json'
//      ) $$
// );
serve(async (req) => {
  const logger = createLoggerWithoutRequest({
    functionName: "auto-refresh-pending-domains",
  });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    logger.debug("Starting pending domain scan", { now });

    const { data: pendingDomains, error: fetchError } = await supabase
      .from("organization_sending_domain")
      .select("id, organization_id, domain_name, resend_domain_id, display_status")
      .in("display_status", ["pending_setup", "pending_dns"])
      .eq("enabled", true);

    if (fetchError) {
      logger.error("Error fetching pending domains", fetchError);
      return errorResponse("Failed to fetch pending domains", 500);
    }

    if (!pendingDomains || pendingDomains.length === 0) {
      logger.debug("No pending domains to refresh");
      return jsonResponse({
        success: true,
        message: "No pending domains",
        processed: 0,
        verified: 0,
      });
    }

    logger.info("Found pending domains to check", {
      count: pendingDomains.length,
    });

    let processed = 0;
    let verified = 0;
    const errors: string[] = [];

    for (const domain of pendingDomains) {
      try {
        if (!domain.resend_domain_id) {
          logger.warn("Domain missing resend_domain_id", {
            domainId: domain.id,
            organization_id: domain.organization_id,
          });
          continue;
        }

        const res = await fetch(`https://api.resend.com/domains/${domain.resend_domain_id}`, {
          method: "GET",
          headers: resendHeaders(),
        });
        const text = await res.text();
        let json: { status?: string; records?: unknown } = {};
        try {
          json = text ? (JSON.parse(text) as typeof json) : {};
        } catch {
          /* */
        }

        if (!res.ok) {
          logger.warn("Resend get domain failed", {
            domainId: domain.id,
            resendStatus: res.status,
          });
          errors.push(`${domain.domain_name}: Resend API ${res.status}`);
          continue;
        }

        const resendStatus = (json.status as string) || "pending";
        const newDisplayStatus = toDisplayStatus(resendStatus);
        const previousDisplayStatus = domain.display_status;

        const { error: updateErr } = await supabase
          .from("organization_sending_domain")
          .update({
            resend_status: resendStatus,
            display_status: newDisplayStatus,
            dns_records_snapshot: json.records ? (json.records as Record<string, unknown>) : null,
            updated_at: now,
          })
          .eq("id", domain.id);

        if (updateErr) {
          logger.warn("Failed to update domain status", {
            domainId: domain.id,
            error: updateErr.message,
          });
          errors.push(`${domain.domain_name}: DB update failed`);
          continue;
        }

        processed++;

        if (newDisplayStatus === "verified" && previousDisplayStatus !== "verified") {
          verified++;
          logger.info("Domain verified", {
            domainId: domain.id,
            domain_name: domain.domain_name,
            organization_id: domain.organization_id,
          });

          const notificationResult = await createNotification(supabase, {
            organization_id: domain.organization_id,
            type: "domain_verified",
            title: "Email domain verified",
            message: `Your custom email domain ${domain.domain_name} has been verified and is ready to use for sending emails.`,
            related_entity_type: "organization_sending_domain",
            related_entity_id: domain.id,
          });

          if (!notificationResult.success) {
            logger.warn("Failed to create domain_verified notification", {
              domainId: domain.id,
              error: notificationResult.error,
            });
          }
        }
      } catch (domainErr) {
        const errMsg = domainErr instanceof Error ? domainErr.message : "Unknown error";
        logger.warn("Error processing domain", {
          domainId: domain.id,
          error: errMsg,
        });
        errors.push(`${domain.domain_name}: ${errMsg}`);
      }
    }

    logger.info("Pending domain scan complete", {
      processed,
      verified,
      errors: errors.length,
    });

    return jsonResponse({
      success: true,
      processed,
      verified,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    logger.error("auto-refresh-pending-domains failed", e);
    return errorResponse(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
