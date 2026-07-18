import { SupabaseClient } from "@supabase/supabase-js";
import { serve } from "server";
import { getOrganizationName, sendAdminInvoiceNotificationEmail } from "../_utils/email.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

interface AutoGenerateConfig {
  enabled: boolean;
  period: "daily" | "weekly" | "monthly";
  day_of_week?: number; // 0-6 (Sunday-Saturday) for weekly
  day_of_month?: number; // 1-31 for monthly
  time?: string; // HH:mm format (e.g., "09:00")
  grouping?: "location" | "all"; // How to group jobs into invoices
  require_review?: boolean; // If true, creates as pending_review, else draft
}

interface LocationHierarchyNode {
  id: string;
  organization_id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  name: string;
}

interface UninvoicedJob {
  id: string;
  organization_id: string;
  location_id: string | null;
  completed_at: string;
  submission_data: unknown;
}

interface LocationWithHierarchy {
  id: string;
  name: string;
  email: string | null;
  hierarchy_parent_id: string | null;
}

/**
 * Get auto-generate config from location hierarchy metadata
 */
function getAutoGenerateConfig(
  metadata: Record<string, unknown> | null
): AutoGenerateConfig | null {
  if (!metadata || typeof metadata !== "object") return null;

  const autoGenerate = metadata.auto_generate_invoices;
  if (!autoGenerate || typeof autoGenerate !== "object") return null;

  const config = autoGenerate as Record<string, unknown>;
  if (config.enabled !== true) return null;

  return {
    enabled: true,
    period: (config.period as "daily" | "weekly" | "monthly") || "weekly",
    day_of_week: config.day_of_week !== undefined ? Number(config.day_of_week) : undefined,
    day_of_month: config.day_of_month !== undefined ? Number(config.day_of_month) : undefined,
    time: (config.time as string) || "09:00",
    grouping: (config.grouping as "location" | "all") || "location",
    require_review: true, // Always require review - not configurable
  };
}

/**
 * Check if auto-generate should run based on configuration and current time
 */
function shouldRunAutoGenerate(config: AutoGenerateConfig, now: Date): boolean {
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
      return config.day_of_week !== undefined && dayOfWeek === config.day_of_week;
    case "monthly":
      return config.day_of_month !== undefined && dayOfMonth === config.day_of_month;
    default:
      return false;
  }
}

/**
 * Generate invoice number (reused from create-invoice)
 */
async function generateInvoiceNumber(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const { data: org, error: orgError } = await supabase
    .from("organization")
    .select("org_code")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) {
    throw new Error("Failed to fetch organization");
  }

  const orgCode = org.org_code;
  const year = new Date().getFullYear();

  const { data: existingInvoices, error: invoiceError } = await supabase
    .from("invoice")
    .select("invoice_number")
    .eq("organization_id", organizationId)
    .like("invoice_number", `${orgCode}-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (invoiceError) {
    throw invoiceError;
  }

  let nextNumber = 1;
  if (existingInvoices && existingInvoices.length > 0) {
    const lastInvoice = existingInvoices[0].invoice_number;
    const match = lastInvoice.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${orgCode}-${year}-${nextNumber.toString().padStart(4, "0")}`;
}

/**
 * Get admin emails for an organization
 */
async function getAdminEmails(supabase: SupabaseClient, organizationId: string): Promise<string[]> {
  const { data: orgUsers, error } = await supabase
    .from("organization_user")
    .select("email")
    .eq("organization_id", organizationId)
    .eq("role", "admin");

  if (error || !orgUsers) {
    return [];
  }

  return orgUsers
    .map((user: { email: string | null }) => user.email)
    .filter((email): email is string => !!email);
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "auto-generate-invoices" });

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
        generated: 0,
      });
    }

    let totalProcessed = 0;
    let totalGenerated = 0;
    const errors: string[] = [];

    for (const org of organizations) {
      try {
        // Get hierarchy nodes with auto-generate enabled
        const { data: hierarchyNodes, error: hierarchyError } = await supabase
          .from("location_hierarchy")
          .select("id, organization_id, type, metadata, name")
          .eq("organization_id", org.id)
          .eq("active", true);

        if (hierarchyError) {
          logger.error("Error fetching hierarchy nodes", hierarchyError, {
            organization_id: org.id,
          });
          continue;
        }

        if (!hierarchyNodes || hierarchyNodes.length === 0) continue;

        // Find nodes with auto-generate enabled that should run now
        const nodesToProcess = hierarchyNodes.filter((node: LocationHierarchyNode) => {
          const config = getAutoGenerateConfig(node.metadata as Record<string, unknown> | null);
          return config && shouldRunAutoGenerate(config, now);
        });

        if (nodesToProcess.length === 0) continue;

        // Get all locations under these hierarchy nodes
        const hierarchyNodeIds = nodesToProcess.map((node: LocationHierarchyNode) => node.id);
        const { data: locations, error: locationsError } = await supabase
          .from("location")
          .select("id, name, email, hierarchy_parent_id")
          .eq("organization_id", org.id)
          .in("hierarchy_parent_id", hierarchyNodeIds);

        if (locationsError) {
          logger.error("Error fetching locations", locationsError, { organization_id: org.id });
          continue;
        }

        if (!locations || locations.length === 0) continue;

        const locationIds = locations.map((loc: LocationWithHierarchy) => loc.id);

        // Find completed jobs that haven't been invoiced
        // A job is invoiced if it has an entry in invoice_job table
        const { data: allJobs, error: jobsError } = await supabase
          .from("job")
          .select("id, organization_id, location_id, completed_at, submission_data")
          .eq("organization_id", org.id)
          .in("location_id", locationIds)
          .not("completed_at", "is", null);

        if (jobsError) {
          logger.error("Error fetching jobs", jobsError, { organization_id: org.id });
          continue;
        }

        if (!allJobs || allJobs.length === 0) continue;

        // Get all invoiced job IDs
        const { data: invoicedJobs, error: invoicedError } = await supabase
          .from("invoice_job")
          .select("job_id")
          .in(
            "job_id",
            allJobs.map((job: UninvoicedJob) => job.id)
          );

        if (invoicedError) {
          logger.error("Error fetching invoiced jobs", invoicedError, { organization_id: org.id });
          continue;
        }

        const invoicedJobIds = new Set(
          (invoicedJobs || []).map((ij: { job_id: string }) => ij.job_id)
        );

        // Filter to uninvoiced jobs
        const uninvoicedJobs = allJobs.filter(
          (job: UninvoicedJob) => !invoicedJobIds.has(job.id)
        ) as UninvoicedJob[];

        if (uninvoicedJobs.length === 0) continue;

        // Get grouping strategy from the first node's config (all nodes should have same config)
        const firstNodeConfig = getAutoGenerateConfig(
          nodesToProcess[0].metadata as Record<string, unknown> | null
        );
        const grouping = firstNodeConfig?.grouping || "location";

        // Group jobs based on grouping strategy
        const jobGroups = new Map<string, UninvoicedJob[]>();

        if (grouping === "all") {
          // All jobs in one group
          jobGroups.set("all", uninvoicedJobs);
        } else {
          // Default: group by location
          for (const job of uninvoicedJobs) {
            const locationKey = job.location_id || "no_location";
            if (!jobGroups.has(locationKey)) {
              jobGroups.set(locationKey, []);
            }
            jobGroups.get(locationKey)!.push(job);
          }
        }

        // Get organization settings for currency and due date calculation
        const { data: orgSettings } = await supabase
          .from("organization_settings")
          .select("currency")
          .eq("organization_id", org.id)
          .single();

        const currency = orgSettings?.currency || "AUD";
        const defaultDueDate = new Date(now);
        defaultDueDate.setDate(defaultDueDate.getDate() + 30); // 30 days from now

        // Create invoices for each group
        const generatedInvoices: Array<{
          invoice_number: string;
          location_name: string;
          job_count: number;
          total: number;
          currency: string;
        }> = [];

        for (const [groupKey, jobs] of jobGroups) {
          if (jobs.length === 0) continue;

          try {
            // Calculate invoice totals
            const { data: calculationData, error: calcError } = await supabase.functions.invoke(
              "calculate-invoice",
              {
                body: {
                  organization_id: org.id,
                  job_ids: jobs.map((j) => j.id),
                  email: null, // Service role call, no email needed
                },
              }
            );

            if (calcError || !calculationData?.calculation) {
              logger.error("Error calculating invoice", calcError, {
                organization_id: org.id,
                job_ids: jobs.map((j) => j.id),
              });
              const groupLabel = grouping === "all" ? "all jobs" : `location ${groupKey}`;
              errors.push(`Failed to calculate invoice for ${jobs.length} jobs in ${groupLabel}`);
              continue;
            }

            const calculation = calculationData.calculation;

            // Generate invoice number
            const invoiceNumber = await generateInvoiceNumber(supabase, org.id);

            // Get config to determine if review is required
            // For "all" grouping, use the first node's config
            // For location grouping, find the location's hierarchy node
            let config: AutoGenerateConfig | null = null;
            let locationName = "Unknown Location";

            if (grouping === "all") {
              // Use first node's config
              const firstNode = nodesToProcess[0];
              config = getAutoGenerateConfig(firstNode.metadata as Record<string, unknown> | null);
              locationName = "All Locations";
            } else {
              // Location grouping - find the location
              const location = locations.find((l: LocationWithHierarchy) => l.id === groupKey);
              locationName = location?.name || "Unknown Location";

              const hierarchyNode = location?.hierarchy_parent_id
                ? hierarchyNodes.find(
                    (n: LocationHierarchyNode) => n.id === location.hierarchy_parent_id
                  )
                : null;
              config = hierarchyNode
                ? getAutoGenerateConfig(hierarchyNode.metadata as Record<string, unknown> | null)
                : null;
            }

            const requireReview = config?.require_review !== false;

            // Create invoice with pending_review status
            const { data: invoice, error: invoiceError } = await supabase
              .from("invoice")
              .insert({
                organization_id: org.id,
                invoice_number: invoiceNumber,
                status: requireReview ? "pending_review" : "draft",
                subtotal: calculation.total_subtotal,
                total: calculation.total,
                currency: currency,
                due_date: defaultDueDate.toISOString(),
                calculation_snapshot: calculation,
              })
              .select()
              .single();

            if (invoiceError) {
              logger.error("Error creating invoice", invoiceError, {
                organization_id: org.id,
                invoice_number: invoiceNumber,
              });
              errors.push(`Failed to create invoice ${invoiceNumber}: ${invoiceError.message}`);
              continue;
            }

            // Create invoice_job records
            const invoiceJobRecords = jobs.map((job) => ({
              invoice_id: invoice.id,
              job_id: job.id,
            }));

            const { error: invoiceJobError } = await supabase
              .from("invoice_job")
              .insert(invoiceJobRecords);

            if (invoiceJobError) {
              logger.error("Error creating invoice_job records", invoiceJobError, {
                invoice_id: invoice.id,
              });
              errors.push(`Failed to link jobs to invoice ${invoiceNumber}`);
              continue;
            }

            // Create pricing snapshots
            const snapshotRecords =
              calculation.job_calculations?.flatMap(
                (jobCalc: {
                  job_id: string;
                  applied_rules?: Array<{
                    pricing_rule_id: string;
                    field_config_id: string | null;
                    line_item_key?: string | null;
                    snapshot_data?: Record<string, unknown>;
                  }>;
                }) =>
                  (jobCalc.applied_rules || []).map((rule) => ({
                    organization_id: org.id,
                    invoice_id: invoice.id,
                    job_id: jobCalc.job_id,
                    pricing_rule_id: rule.pricing_rule_id,
                    field_config_id: rule.field_config_id || null,
                    line_item_key: rule.line_item_key || null,
                    snapshot_data: rule.snapshot_data || {},
                  }))
              ) || [];

            if (snapshotRecords.length > 0) {
              const { error: snapshotError } = await supabase
                .from("pricing_snapshot")
                .insert(snapshotRecords);

              if (snapshotError) {
                logger.warn("Error creating pricing snapshots (non-critical)", snapshotError);
              }
            }

            generatedInvoices.push({
              invoice_number: invoiceNumber,
              location_name: locationName,
              job_count: jobs.length,
              total: calculation.total,
              currency: currency,
            });

            totalGenerated++;
            logger.info("Auto-generated invoice", {
              organization_id: org.id,
              invoice_id: invoice.id,
              invoice_number: invoiceNumber,
              job_count: jobs.length,
              status: requireReview ? "pending_review" : "draft",
            });
          } catch (err) {
            logger.error("Error processing location group", err, {
              organization_id: org.id,
              group_key: groupKey,
              grouping: grouping,
            });
            const groupLabel = grouping === "all" ? "all jobs" : `location ${groupKey}`;
            errors.push(
              `Failed to process ${groupLabel}: ${
                err instanceof Error ? err.message : "Unknown error"
              }`
            );
          }
        }

        totalProcessed += uninvoicedJobs.length;

        // Send notification email to admins if invoices were generated
        if (generatedInvoices.length > 0) {
          const adminEmails = await getAdminEmails(supabase, org.id);
          if (adminEmails.length > 0) {
            try {
              const organizationName = await getOrganizationName(supabase, org.id);
              // Get base URL from environment or use default
              const baseUrl = Deno.env.get("DASHBOARD_BASE_URL") || "https://app.tallyrunner.com";
              const reviewUrl = `${baseUrl}/dashboard/invoicing?status=pending_review`;

              const emailResult = await sendAdminInvoiceNotificationEmail(
                supabase,
                {
                  organizationName,
                  organizationId: org.id,
                  recipientEmails: adminEmails,
                  invoiceCount: generatedInvoices.length,
                  invoices: generatedInvoices,
                  reviewUrl,
                },
                false
              );

              if (emailResult.success) {
                logger.info("Admin notification email sent", {
                  organization_id: org.id,
                  admin_emails: adminEmails,
                  invoice_count: generatedInvoices.length,
                  email_id: emailResult.emailId,
                });
              } else {
                logger.warn("Failed to send admin notification email", {
                  organization_id: org.id,
                  error: emailResult.error,
                });
              }
            } catch (emailError) {
              logger.error("Error sending admin notification email", emailError, {
                organization_id: org.id,
              });
            }
          }
        }
      } catch (err) {
        logger.error("Error processing organization", err, {
          organization_id: org.id,
          organization_name: org.name,
        });
        errors.push(
          `Failed to process org ${org.name}: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }
    }

    logger.info("Auto-generate invoices completed", {
      total_processed: totalProcessed,
      total_generated: totalGenerated,
      error_count: errors.length,
    });

    return jsonResponse({
      success: true,
      message: `Processed ${totalProcessed} jobs, generated ${totalGenerated} invoices`,
      processed: totalProcessed,
      generated: totalGenerated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error("Auto-generate invoices error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to auto-generate invoices",
      500
    );
  }
});
