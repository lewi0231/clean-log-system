import {
  getOrganizationName,
  type InvoiceEmailData,
  sendInvoiceEmail,
} from "../../_utils/email.ts";
import { jsonResponse } from "../../_utils/http.ts";
import {
  getInvoiceEmailRecipients,
  greetingFirstNameFromJobContexts,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "../../_utils/invoice-email.ts";
import { generateInvoicePdfBase64 } from "../../_utils/invoice-pdf.ts";
import { createLogger } from "../../_utils/logger.ts";
import {
  getAutoSendConfig,
  getOrgAutoSendConfig,
  shouldRunAutoSend,
} from "./auto-send-scheduling.ts";
import type { DraftInvoice, InvoiceWithDetails, Location, LocationHierarchyNode } from "./types.ts";

type Logger = ReturnType<typeof createLogger>;
type ServiceSupabase = ReturnType<
  typeof import("../../_utils/supabase.ts").createServiceRoleClient
>;

export async function runAutoSendInvoicesPersistence(
  supabase: ServiceSupabase,
  now: Date,
  logger: Logger
): Promise<Response> {
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
          `
        )
        .eq("organization_id", org.id)
        .eq("status", "draft");

      if (invoicesError) {
        logger.error("Error fetching invoices for organization", invoicesError, {
          organization_id: org.id,
        });
        continue;
      }

      if (!draftInvoices || draftInvoices.length === 0) continue;

      const hierarchyCoveredLocationIds = new Set<string>();
      const invoicesToSend: DraftInvoice[] = [];

      const { data: hierarchyNodes, error: hierarchyError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id, type, metadata, name")
        .eq("organization_id", org.id)
        .eq("active", true);

      if (!hierarchyError && hierarchyNodes && hierarchyNodes.length > 0) {
        const nodesToProcess = hierarchyNodes.filter((node: LocationHierarchyNode) => {
          const config = getAutoSendConfig(node.metadata);
          return config && shouldRunAutoSend(config, now);
        });

        if (nodesToProcess.length > 0) {
          const hierarchyIds = nodesToProcess.map((n: LocationHierarchyNode) => n.id);
          const { data: locations, error: locationsError } = await supabase
            .from("location")
            .select("id, hierarchy_parent_id")
            .in("hierarchy_parent_id", hierarchyIds)
            .eq("active", true);

          if (!locationsError && locations && locations.length > 0) {
            const locationIds = locations.map((l: Location) => l.id);
            locationIds.forEach((id: string) => hierarchyCoveredLocationIds.add(id));

            const hierarchyInvoices = draftInvoices.filter((invoice) => {
              if (!invoice.invoice_job || !Array.isArray(invoice.invoice_job)) {
                return false;
              }
              return invoice.invoice_job.some((ij) => {
                const job = Array.isArray(ij.job) ? ij.job[0] : ij.job;
                return job?.location_id && locationIds.includes(job.location_id);
              });
            });

            invoicesToSend.push(...hierarchyInvoices);
          }
        }
      }

      const { data: orgSettings, error: orgSettingsError } = await supabase
        .from("organization_settings")
        .select("auto_send_invoices_config")
        .eq("organization_id", org.id)
        .single();

      if (!orgSettingsError && orgSettings?.auto_send_invoices_config) {
        const orgConfig = getOrgAutoSendConfig(orgSettings.auto_send_invoices_config);

        if (orgConfig && shouldRunAutoSend(orgConfig, now)) {
          const orgLevelInvoices = draftInvoices.filter((invoice) => {
            if (invoicesToSend.some((inv) => inv.id === invoice.id)) {
              return false;
            }

            if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
              const hasHierarchyCoveredLocation = invoice.invoice_job.some((ij) => {
                const job = Array.isArray(ij.job) ? ij.job[0] : ij.job;
                return job?.location_id && hierarchyCoveredLocationIds.has(job.location_id);
              });
              return !hasHierarchyCoveredLocation;
            }

            return true;
          });

          invoicesToSend.push(...orgLevelInvoices);
        }
      }

      if (invoicesToSend.length === 0) continue;

      const { data: templateConfig } = await supabase
        .from("invoice_template_config")
        .select("email_recipient_config")
        .eq("organization_id", org.id)
        .single();

      const emailConfig: InvoiceEmailRecipientConfig =
        (templateConfig?.email_recipient_config as InvoiceEmailRecipientConfig) || {
          location_email_source: "location_email",
          form_field_email: null,
          default_email: null,
        };

      const { data: fieldConfigs } = await supabase
        .from("organization_field_configs")
        .select("id, name")
        .eq("organization_id", org.id)
        .eq("active", true);

      const fieldConfigMap = new Map<string, { name: string }>(
        (fieldConfigs || []).map((fc: { id: string; name: string }) => [fc.id, { name: fc.name }])
      );

      const invoiceIds = invoicesToSend.map((inv) => inv.id);
      const { data: invoicesWithDetails, error: detailsError } = await supabase
        .from("invoice")
        .select(
          `
            id,
            invoice_number,
            total,
            currency,
            due_date,
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
          `
        )
        .in("id", invoiceIds);

      if (detailsError || !invoicesWithDetails) {
        logger.error("Error fetching invoice details", detailsError, {
          organization_id: org.id,
          invoice_count: invoiceIds.length,
        });
        errors.push(`Failed to fetch invoice details for ${invoiceIds.length} invoices`);
        continue;
      }

      const invoiceDetailsMap = new Map<string, InvoiceWithDetails>(
        invoicesWithDetails.map((inv) => [inv.id, inv as unknown as InvoiceWithDetails])
      );

      for (const invoice of invoicesToSend) {
        try {
          const invoiceWithJobs = invoiceDetailsMap.get(invoice.id);
          if (!invoiceWithJobs) {
            logger.warn("Invoice details not found in pre-fetched data", {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
            });
            errors.push(`Failed to fetch invoice details ${invoice.invoice_number}`);
            continue;
          }

          const jobContexts: JobContext[] = [];
          if (invoiceWithJobs.invoice_job && Array.isArray(invoiceWithJobs.invoice_job)) {
            for (const invoiceJob of invoiceWithJobs.invoice_job) {
              const jobRaw = invoiceJob.job as unknown;
              const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
              if (job && typeof job === "object") {
                const j = job as {
                  location_id?: string | null;
                  submission_data?: Record<string, unknown> | null;
                  location?:
                    | {
                        id: string;
                        email: string | null;
                        contact_person: string | null;
                        hierarchy_parent_id: string | null;
                      }
                    | Array<{
                        id: string;
                        email: string | null;
                        contact_person: string | null;
                        hierarchy_parent_id: string | null;
                      }>
                    | null;
                };
                const locationRaw = j.location;
                const location = Array.isArray(locationRaw) ? locationRaw[0] : locationRaw;

                jobContexts.push({
                  location_id: j.location_id || null,
                  location: location
                    ? {
                        id: location.id,
                        email: location.email || null,
                        contact_person: location.contact_person || null,
                        hierarchy_parent_id: location.hierarchy_parent_id || null,
                      }
                    : null,
                  submission_data: j.submission_data || null,
                });
              }
            }
          }

          const emailRecipients = await getInvoiceEmailRecipients(
            supabase,
            jobContexts,
            emailConfig,
            fieldConfigMap
          );

          if (emailRecipients.length === 0) {
            logger.warn("Skipping invoice - no valid email recipients", {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              organization_id: org.id,
            });
            errors.push(`Invoice ${invoice.invoice_number} has no valid email recipients`);
            continue;
          }

          let organizationName: string;
          try {
            organizationName = await getOrganizationName(supabase, org.id);
          } catch (err) {
            logger.error("Failed to get organization name", err, {
              organization_id: org.id,
              invoice_id: invoice.id,
            });
            errors.push(`Failed to get organization name for invoice ${invoice.invoice_number}`);
            continue;
          }

          if (!invoiceWithJobs.total || !invoiceWithJobs.due_date) {
            logger.error("Invoice missing required fields", {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
            });
            errors.push(`Failed to get invoice totals for ${invoice.invoice_number}`);
            continue;
          }

          let pdfAttachment: { base64: string; filename: string };
          try {
            const pdf = await generateInvoicePdfBase64(supabase, invoice.id, org.id);
            pdfAttachment = { base64: pdf.base64, filename: pdf.filename };
          } catch (pdfErr) {
            logger.error("Failed to generate invoice PDF", pdfErr, {
              invoice_id: invoice.id,
            });
            errors.push(`Failed to generate PDF for invoice ${invoice.invoice_number}`);
            continue;
          }

          const greetingName = greetingFirstNameFromJobContexts(jobContexts);

          const emailData: InvoiceEmailData = {
            invoiceNumber: invoice.invoice_number,
            organizationName,
            organizationId: org.id,
            recipientEmails: emailRecipients,
            total: invoiceWithJobs.total,
            currency: invoiceWithJobs.currency || "AUD",
            dueDate: invoiceWithJobs.due_date,
            pdfBase64: pdfAttachment.base64,
            pdfFilename: pdfAttachment.filename,
            recipientGreetingName: greetingName,
          };

          const emailResult = await sendInvoiceEmail(supabase, emailData, false);

          if (!emailResult.success) {
            logger.error("Failed to send invoice email", undefined, {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              error: emailResult.error,
            });
            errors.push(
              `Failed to send email for invoice ${invoice.invoice_number}: ${emailResult.error}`
            );
            continue;
          }

          const { error: updateError } = await supabase
            .from("invoice")
            .update({
              status: "sent",
              updated_at: now.toISOString(),
            })
            .eq("id", invoice.id);

          if (updateError) {
            logger.error("Error updating invoice status after email send", updateError, {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
            });
            errors.push(
              `Failed to update invoice ${invoice.invoice_number} after email send: ${updateError.message}`
            );
            logger.warn("Email sent but status update failed", {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
            });
            continue;
          }

          logger.info("Auto-sent invoice successfully", {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            organization_id: org.id,
            recipient_count: emailRecipients.length,
            email_id: emailResult.emailId,
          });

          totalSent++;
        } catch (err) {
          logger.error("Error processing invoice", err, {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            organization_id: org.id,
          });
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Failed to process invoice ${invoice.invoice_number}: ${errorMsg}`);
        }
      }

      totalProcessed += invoicesToSend.length;
      logger.info("Completed processing organization invoices", {
        organization_id: org.id,
        organization_name: org.name,
        invoices_processed: invoicesToSend.length,
        invoices_sent: totalSent,
      });
    } catch (err) {
      logger.error("Error processing organization", err, {
        organization_id: org.id,
        organization_name: org.name,
      });
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to process org ${org.name}: ${errorMsg}`);
    }
  }

  logger.info("Auto-send invoices completed", {
    total_processed: totalProcessed,
    total_sent: totalSent,
    error_count: errors.length,
  });

  return jsonResponse({
    success: true,
    message: `Processed ${totalProcessed} invoices, sent ${totalSent}`,
    processed: totalProcessed,
    sent: totalSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
