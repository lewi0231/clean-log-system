import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

/**
 * Delete test job and associated invoice data
 * This is used to clean up test data created during the test invoice process
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "delete-test-data" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, job_id, invoice_id } = body;

    if (!job_id && !invoice_id) {
      return errorResponse(
        "Either job_id or invoice_id is required",
        400,
      );
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
      body as Record<string, unknown>,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // If invoice_id is provided, delete the invoice first
    if (invoice_id) {
      // Verify the invoice belongs to the organization and is a test invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoice")
        .select("id, organization_id")
        .eq("id", invoice_id)
        .eq("organization_id", organization_id)
        .single();

      if (invoiceError && invoiceError.code !== "PGRST116") {
        throw invoiceError;
      }

      if (invoice) {
        // Delete pricing_snapshot records for this invoice
        const { error: snapshotError } = await supabase
          .from("pricing_snapshot")
          .delete()
          .eq("invoice_id", invoice_id);

        if (snapshotError) {
          logger.warn("Failed to delete pricing snapshots", {
            invoice_id,
            error: snapshotError,
          });
        }

        // Delete invoice_job records
        const { error: invoiceJobError } = await supabase
          .from("invoice_job")
          .delete()
          .eq("invoice_id", invoice_id);

        if (invoiceJobError) {
          logger.warn("Failed to delete invoice_job records", {
            invoice_id,
            error: invoiceJobError,
          });
        }

        // Delete the invoice
        const { error: deleteInvoiceError } = await supabase
          .from("invoice")
          .delete()
          .eq("id", invoice_id);

        if (deleteInvoiceError) {
          logger.warn("Failed to delete invoice", {
            invoice_id,
            error: deleteInvoiceError,
          });
        } else {
          logger.info("Deleted test invoice", { invoice_id });
        }
      }
    }

    // If job_id is provided, delete the job
    if (job_id) {
      // Verify the job belongs to the organization
      const { data: job, error: jobError } = await supabase
        .from("job")
        .select("id, organization_id, submission_data")
        .eq("id", job_id)
        .eq("organization_id", organization_id)
        .single();

      if (jobError && jobError.code !== "PGRST116") {
        throw jobError;
      }

      if (job) {
        // Verify it's a test job by checking submission_data._is_test
        const submissionData = job.submission_data as Record<
          string,
          unknown
        >;
        if (!submissionData?._is_test) {
          return errorResponse(
            "Cannot delete non-test jobs. Only jobs marked with _is_test can be deleted.",
            400,
          );
        }

        // Delete job_worker records first
        const { error: jobWorkerError } = await supabase
          .from("job_worker")
          .delete()
          .eq("job_id", job_id);

        if (jobWorkerError) {
          logger.warn("Failed to delete job_worker records", {
            job_id,
            error: jobWorkerError,
          });
        }

        // Delete any invoice_job records that reference this job
        const { error: invoiceJobError } = await supabase
          .from("invoice_job")
          .delete()
          .eq("job_id", job_id);

        if (invoiceJobError) {
          logger.warn(
            "Failed to delete invoice_job records for job",
            {
              job_id,
              error: invoiceJobError,
            },
          );
        }

        // Delete the job
        const { error: deleteJobError } = await supabase
          .from("job")
          .delete()
          .eq("id", job_id);

        if (deleteJobError) {
          logger.warn("Failed to delete job", {
            job_id,
            error: deleteJobError,
          });
        } else {
          logger.info("Deleted test job", { job_id });
        }
      }
    }

    return jsonResponse({
      success: true,
      message: "Test data deleted successfully",
    });
  } catch (error) {
    logger.error("Delete test data error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete test data",
      500,
    );
  }
});
