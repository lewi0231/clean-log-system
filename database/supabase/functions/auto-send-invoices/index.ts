import { serve } from "server";
import {
  getOrganizationName,
  type InvoiceEmailData,
  sendInvoiceEmail,
} from "../_utils/email.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import {
  getInvoiceEmailRecipients,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "../_utils/invoice-email.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

interface LocationHierarchyNode {
  id: string;
  organization_id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  name: string;
}

interface Location {
  id: string;
  hierarchy_parent_id: string | null;
}

interface InvoiceJob {
  job?: {
    location_id?: string;
  };
}

interface DraftInvoice {
  id: string;
  invoice_number: string;
  organization_id: string;
  invoice_job?: InvoiceJob[];
}

interface AutoSendConfig {
  enabled: boolean;
  period: "daily" | "weekly" | "monthly";
  day_of_week?: number; // 0-6 (Sunday-Saturday) for weekly
  day_of_month?: number; // 1-31 for monthly
  time?: string; // HH:mm format (e.g., "09:00")
}

/**
 * Check if auto-send should run based on configuration and current time
 */
function shouldRunAutoSend(
  config: AutoSendConfig,
  now: Date,
): boolean {
  if (!config.enabled) return false;

  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const dayOfMonth = now.getDate();

  // Parse time if provided
  if (config.time) {
    const [configHour, configMinute] = config.time.split(":").map(Number);
    if (hour !== configHour || minute !== configMinute) {
      return false; // Not the right time
    }
  }

  switch (config.period) {
    case "daily":
      return true; // Run daily at the specified time
    case "weekly":
      return config.day_of_week !== undefined &&
        dayOfWeek === config.day_of_week;
    case "monthly":
      return config.day_of_month !== undefined &&
        dayOfMonth === config.day_of_month;
    default:
      return false;
  }
}

/**
 * Get auto-send config from location hierarchy metadata
 */
function getAutoSendConfig(
  metadata: Record<string, unknown> | null,
): AutoSendConfig | null {
  if (!metadata || typeof metadata !== "object") return null;

  const autoSend = metadata.auto_send_invoices;
  if (!autoSend || typeof autoSend !== "object") return null;

  const config = autoSend as Record<string, unknown>;
  if (config.enabled !== true) return null;

  return {
    enabled: true,
    period: (config.period as "daily" | "weekly" | "monthly") || "daily",
    day_of_week: config.day_of_week !== undefined
      ? Number(config.day_of_week)
      : undefined,
    day_of_month: config.day_of_month !== undefined
      ? Number(config.day_of_month)
      : undefined,
    time: (config.time as string) || "09:00",
  };
}

/**
 * Get organization-level auto-send config from organization_settings
 */
function getOrgAutoSendConfig(
  configJson: unknown,
): AutoSendConfig | null {
  if (!configJson || typeof configJson !== "object") return null;

  const config = configJson as Record<string, unknown>;
  if (config.enabled !== true) return null;

  return {
    enabled: true,
    period: (config.period as "daily" | "weekly" | "monthly") || "daily",
    day_of_week: config.day_of_week !== undefined
      ? Number(config.day_of_week)
      : undefined,
    day_of_month: config.day_of_month !== undefined
      ? Number(config.day_of_month)
      : undefined,
    time: (config.time as string) || "09:00",
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createServiceRoleClient();
    const now = new Date();

    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from("organization")
      .select("id, name");

    if (orgError) throw orgError;

    if (!organizations || organizations.length === 0) {
      return jsonResponse({
        success: true,
        message: "No organizations found",
        processed: 0,
      });
    }

    let totalProcessed = 0;
    let totalSent = 0;
    const errors: string[] = [];

    for (const org of organizations) {
      try {
        // Get all draft invoices for this organization
        const { data: draftInvoices, error: invoicesError } = await supabase
          .from("invoice")
          .select(
            `
            id,
            invoice_number,
            organization_id,
            invoice_job:invoice_job (
              job:job_id (
                location_id
              )
            )
          `,
          )
          .eq("organization_id", org.id)
          .eq("status", "draft");

        if (invoicesError) {
          console.error(
            `Error fetching invoices for org ${org.id}:`,
            invoicesError,
          );
          continue;
        }

        if (!draftInvoices || draftInvoices.length === 0) continue;

        // Track which location IDs are covered by hierarchy auto-send
        const hierarchyCoveredLocationIds = new Set<string>();
        const invoicesToSend: DraftInvoice[] = [];

        // Process hierarchy-based auto-send (takes precedence)
        const { data: hierarchyNodes, error: hierarchyError } = await supabase
          .from("location_hierarchy")
          .select("id, organization_id, type, metadata, name")
          .eq("organization_id", org.id)
          .eq("active", true);

        if (!hierarchyError && hierarchyNodes && hierarchyNodes.length > 0) {
          // Find nodes with auto-send enabled that should run now
          const nodesToProcess = hierarchyNodes.filter(
            (node: LocationHierarchyNode) => {
              const config = getAutoSendConfig(node.metadata);
              return config && shouldRunAutoSend(config, now);
            },
          );

          if (nodesToProcess.length > 0) {
            const hierarchyIds = nodesToProcess.map((
              n: LocationHierarchyNode,
            ) => n.id);
            const { data: locations, error: locationsError } = await supabase
              .from("location")
              .select("id, hierarchy_parent_id")
              .in("hierarchy_parent_id", hierarchyIds)
              .eq("active", true);

            if (!locationsError && locations && locations.length > 0) {
              const locationIds = locations.map((l: Location) => l.id);
              locationIds.forEach((id: string) =>
                hierarchyCoveredLocationIds.add(id)
              );

              // Filter invoices that belong to locations in the hierarchy nodes
              const hierarchyInvoices = draftInvoices.filter(
                (invoice: DraftInvoice) => {
                  if (
                    !invoice.invoice_job || !Array.isArray(invoice.invoice_job)
                  ) {
                    return false;
                  }
                  return invoice.invoice_job.some(
                    (ij: InvoiceJob) =>
                      ij.job?.location_id &&
                      locationIds.includes(ij.job.location_id),
                  );
                },
              );

              invoicesToSend.push(...hierarchyInvoices);
            }
          }
        }

        // Process organization-level auto-send for invoices not covered by hierarchy
        const { data: orgSettings, error: orgSettingsError } = await supabase
          .from("organization_settings")
          .select("auto_send_invoices_config")
          .eq("organization_id", org.id)
          .single();

        if (!orgSettingsError && orgSettings?.auto_send_invoices_config) {
          const orgConfig = getOrgAutoSendConfig(
            orgSettings.auto_send_invoices_config,
          );

          if (orgConfig && shouldRunAutoSend(orgConfig, now)) {
            // Get invoices not covered by hierarchy auto-send
            const orgLevelInvoices = draftInvoices.filter(
              (invoice: DraftInvoice) => {
                // Skip if already in invoicesToSend (covered by hierarchy)
                if (invoicesToSend.some((inv) => inv.id === invoice.id)) {
                  return false;
                }

                // If invoice has locations, only include if none are covered by hierarchy
                if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
                  const hasHierarchyCoveredLocation = invoice.invoice_job.some(
                    (ij: InvoiceJob) =>
                      ij.job?.location_id &&
                      hierarchyCoveredLocationIds.has(ij.job.location_id),
                  );
                  return !hasHierarchyCoveredLocation;
                }

                // Invoice with no locations or no location hierarchy coverage
                return true;
              },
            );

            invoicesToSend.push(...orgLevelInvoices);
          }
        }

        if (invoicesToSend.length === 0) continue;

        // Get invoice template config for email recipient configuration
        const { data: templateConfig } = await supabase
          .from("invoice_template_config")
          .select("email_recipient_config")
          .eq("organization_id", org.id)
          .single();

        const emailConfig: InvoiceEmailRecipientConfig = (templateConfig
          ?.email_recipient_config as InvoiceEmailRecipientConfig) ||
          {
            location_email_source: "location_email",
            form_field_email: null,
            default_email: null,
          };

        // Get field configs for form field email mapping
        const { data: fieldConfigs } = await supabase
          .from("organization_field_configs")
          .select("id, name")
          .eq("organization_id", org.id)
          .eq("active", true);

        const fieldConfigMap = new Map<string, { name: string }>(
          (fieldConfigs || []).map(
            (fc: { id: string; name: string }) => [fc.id, { name: fc.name }],
          ),
        );

        // Send invoices
        for (const invoice of invoicesToSend) {
          try {
            // Get invoice with full job details for email recipient determination
            const { data: invoiceWithJobs, error: detailsError } =
              await supabase
                .from("invoice")
                .select(
                  `
                id,
                invoice_job:invoice_job (
                  job:job_id (
                    id,
                    location_id,
                    submission_data,
                    location:location_id (
                      id,
                      email,
                      contact_person,
                      hierarchy_parent_id
                    )
                  )
                )
              `,
                )
                .eq("id", invoice.id)
                .single();

            if (detailsError || !invoiceWithJobs) {
              console.error(
                `Error fetching invoice details ${invoice.id}:`,
                detailsError,
              );
              errors.push(
                `Failed to fetch invoice details ${invoice.invoice_number}`,
              );
              continue;
            }

            // Build job contexts for email recipient determination
            const jobContexts: JobContext[] = [];
            if (
              invoiceWithJobs.invoice_job &&
              Array.isArray(invoiceWithJobs.invoice_job)
            ) {
              for (const invoiceJob of invoiceWithJobs.invoice_job) {
                if (invoiceJob.job) {
                  jobContexts.push({
                    location_id: invoiceJob.job.location_id || null,
                    location: invoiceJob.job.location
                      ? {
                        id: invoiceJob.job.location.id,
                        email: invoiceJob.job.location.email || null,
                        contact_person:
                          invoiceJob.job.location.contact_person || null,
                        hierarchy_parent_id:
                          invoiceJob.job.location.hierarchy_parent_id || null,
                      }
                      : null,
                    submission_data: (invoiceJob.job.submission_data as Record<
                      string,
                      unknown
                    >) || null,
                  });
                }
              }
            }

            // Determine email recipients
            const emailRecipients = await getInvoiceEmailRecipients(
              supabase,
              jobContexts,
              emailConfig,
              fieldConfigMap,
            );

            // Skip if no valid email recipients
            if (emailRecipients.length === 0) {
              console.warn(
                `Skipping invoice ${invoice.invoice_number} for org ${org.id}: no valid email recipients found`,
              );
              errors.push(
                `Invoice ${invoice.invoice_number} has no valid email recipients`,
              );
              continue;
            }

            // Get organization name for email
            let organizationName: string;
            try {
              organizationName = await getOrganizationName(supabase, org.id);
            } catch (err) {
              console.error(
                `Failed to get organization name for org ${org.id}:`,
                err,
              );
              errors.push(
                `Failed to get organization name for invoice ${invoice.invoice_number}`,
              );
              continue;
            }

            // Get invoice totals for email
            const { data: invoiceTotals, error: invoiceTotalsError } =
              await supabase
                .from("invoice")
                .select("total, currency, due_date")
                .eq("id", invoice.id)
                .single();

            if (invoiceTotalsError || !invoiceTotals) {
              console.error(
                `Failed to get invoice totals ${invoice.id}:`,
                invoiceTotalsError,
              );
              errors.push(
                `Failed to get invoice totals for ${invoice.invoice_number}`,
              );
              continue;
            }

            // Send invoice email
            const emailData: InvoiceEmailData = {
              invoiceNumber: invoice.invoice_number,
              organizationName,
              recipientEmails: emailRecipients,
              total: invoiceTotals.total,
              currency: invoiceTotals.currency || "AUD",
              dueDate: invoiceTotals.due_date,
            };

            const emailResult = await sendInvoiceEmail(emailData, false);

            if (!emailResult.success) {
              console.error(
                `Failed to send email for invoice ${invoice.invoice_number}:`,
                emailResult.error,
              );
              errors.push(
                `Failed to send email for invoice ${invoice.invoice_number}: ${emailResult.error}`,
              );
              // Don't update status if email failed
              continue;
            }

            // Only update invoice status to "sent" after successful email send
            const { error: updateError } = await supabase
              .from("invoice")
              .update({
                status: "sent",
                updated_at: now.toISOString(),
              })
              .eq("id", invoice.id);

            if (updateError) {
              console.error(
                `Error updating invoice ${invoice.id} after email send:`,
                updateError,
              );
              errors.push(
                `Failed to update invoice ${invoice.invoice_number} after email send: ${updateError.message}`,
              );
              // Email was sent but status update failed - log warning
              console.warn(
                `Email sent for invoice ${invoice.invoice_number} but status update failed`,
              );
              continue;
            }

            console.log(
              `Auto-sent invoice ${invoice.invoice_number} for org ${org.id} to: ${
                emailRecipients.join(", ")
              } (Email ID: ${emailResult.emailId || "unknown"})`,
            );

            totalSent++;
          } catch (err) {
            const errorMsg = err instanceof Error
              ? err.message
              : "Unknown error";
            console.error(
              `Error processing invoice ${invoice.id}:`,
              errorMsg,
            );
            errors.push(
              `Failed to process invoice ${invoice.invoice_number}: ${errorMsg}`,
            );
          }
        }

        totalProcessed += invoicesToSend.length;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error processing org ${org.id}:`, errorMsg);
        errors.push(`Failed to process org ${org.name}: ${errorMsg}`);
      }
    }

    return jsonResponse({
      success: true,
      message: `Processed ${totalProcessed} invoices, sent ${totalSent}`,
      processed: totalProcessed,
      sent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Auto-send invoices error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to auto-send invoices",
      500,
    );
  }
});
