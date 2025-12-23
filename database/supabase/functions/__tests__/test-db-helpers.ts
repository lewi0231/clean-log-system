/**
 * Test database helpers for Edge Function integration tests
 *
 * These helpers create and clean up test data in a real local Supabase database.
 * They use the service role key to bypass RLS for test setup/teardown.
 *
 * Run with: deno test --allow-all --allow-env --allow-net
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface TestDataIds {
  organizationId: string;
  locationId: string;
  hierarchyNodeId?: string;
  fieldConfigIds: string[];
  pricingRuleIds?: string[];
  jobIds?: string[];
  invoiceIds?: string[];
  workerId?: string;
  organizationUserEmail?: string;
}

// Singleton Supabase client to avoid multiple GoTrueClient instances
let testSupabaseClient: SupabaseClient | null = null;

/**
 * Get service role key from supabase status command
 * This is a fallback if environment variable is not set
 */
async function getServiceRoleKeyFromStatus(): Promise<string | null> {
  try {
    const databaseDir = new URL("../../../../", import.meta.url).pathname;

    // First try JSON output (more reliable)
    try {
      const jsonCommand = new Deno.Command("supabase", {
        args: ["status", "--output", "json"],
        cwd: databaseDir,
        stdout: "piped",
        stderr: "piped",
      });

      const { stdout, success } = await jsonCommand.output();

      if (success) {
        const output = new TextDecoder().decode(stdout);
        const status = JSON.parse(output);

        // Try different possible paths in the JSON structure
        const possiblePaths = [
          status?.DB?.service_role_key,
          status?.service_role_key,
          status?.db?.service_role_key,
          status?.database?.service_role_key,
        ];

        for (const key of possiblePaths) {
          if (key && typeof key === "string" && key.startsWith("eyJ")) {
            return key;
          }
        }
      }
    } catch (_jsonError) {
      // JSON parsing failed, try text output
    }

    // Fallback to text output parsing
    const textCommand = new Deno.Command("supabase", {
      args: ["status"],
      cwd: databaseDir,
      stdout: "piped",
      stderr: "piped",
    });

    const { stdout, success } = await textCommand.output();

    if (!success) {
      return null;
    }

    const output = new TextDecoder().decode(stdout);

    // Parse the output to find service_role key
    // Try multiple patterns that might appear in supabase status output
    const patterns = [
      /service_role key:\s*([^\s\n]+)/i, // "service_role key: eyJ..."
      /service_role_key:\s*([^\s\n]+)/i, // "service_role_key: eyJ..."
      /service_role[_\s]+key[:\s]+([^\s\n]+)/i, // Flexible spacing
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        const key = match[1].trim();
        // Basic validation - JWT tokens start with "eyJ"
        if (key.startsWith("eyJ")) {
          return key;
        }
      }
    }

    return null;
  } catch (_error) {
    // Command failed or not available
    return null;
  }
}

/**
 * Create or get existing Supabase client with service role key for test database operations
 * Uses singleton pattern to avoid multiple GoTrueClient instances
 *
 * This function will:
 * 1. Try to use SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment
 * 2. Load from .env file if available (using loadEnvIfLocal)
 * 3. Default SUPABASE_URL to http://localhost:54321 for local development
 * 4. Try to get service role key from 'supabase status' command as fallback
 */
export async function createTestSupabaseClient(): Promise<SupabaseClient> {
  if (testSupabaseClient) {
    return testSupabaseClient;
  }

  // Try to load .env file first (if available)
  // The .env file is in supabase/functions/.env (one directory up from __tests__)
  try {
    const { loadEnvIfLocal } = await import("../_utils/env.ts");
    // loadEnvIfLocal looks for .env in current directory, so we need to
    // change to the functions directory first
    const originalCwd = Deno.cwd();
    try {
      // Get the functions directory path (parent of __tests__)
      const functionsDir = new URL("../", import.meta.url).pathname;
      Deno.chdir(functionsDir);
      await loadEnvIfLocal();
    } finally {
      // Restore original directory
      Deno.chdir(originalCwd);
    }
  } catch (_error) {
    // If loadEnvIfLocal fails, continue without it
    // (error is intentionally unused - we just want to continue)
  }

  // Get environment variables with helpful defaults for local development
  let supabaseUrl = Deno.env.get("SUPABASE_URL");
  let serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Default to local Supabase URL if not set
  if (!supabaseUrl) {
    supabaseUrl = "http://localhost:54321";
    console.log(
      "ℹ️  SUPABASE_URL not set, using default: http://localhost:54321",
    );
  }

  // Try to get service role key from supabase status if not set
  if (!serviceRoleKey) {
    console.log(
      "ℹ️  SUPABASE_SERVICE_ROLE_KEY not set, trying to get from 'supabase status'...",
    );
    const keyFromStatus = await getServiceRoleKeyFromStatus();

    if (keyFromStatus) {
      serviceRoleKey = keyFromStatus;
      console.log("✅ Got service role key from 'supabase status'");
    } else {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required for integration tests.\n\n" +
          "Options:\n" +
          "1. Set it as an environment variable: export SUPABASE_SERVICE_ROLE_KEY='<key>'\n" +
          "2. Add it to a .env file in the database directory\n" +
          "3. Get it by running: cd database && supabase status\n" +
          "   Then copy the 'service_role key' value",
      );
    }
  }

  // Create client directly with the values we have
  // Don't rely on createServiceRoleClient since it requires env vars to be set
  const { createClient } = await import("@supabase/supabase-js");
  testSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `test-${Date.now()}`,
    },
  });

  return testSupabaseClient;
}

/**
 * Reset the test Supabase client (useful for cleanup between test suites)
 */
export function resetTestSupabaseClient(): void {
  testSupabaseClient = null;
}

/**
 * Wait for a specified amount of time (for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Setup test database with organization, location, hierarchy node, and field configs
 */
export async function setupTestDatabase(): Promise<TestDataIds> {
  const supabase = await createTestSupabaseClient();
  const testId = `test_${Date.now()}_${
    Math.random().toString(36).substring(7)
  }`;
  const uniqueSuffix = `${Date.now().toString(36)}${
    Math.random().toString(36).substring(2, 6)
  }`.toUpperCase();

  try {
    // Create test organization
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .insert({
        name: `Test Organization ${testId}`,
        org_code: `T${uniqueSuffix}`,
        use_predefined_locations: true,
      })
      .select()
      .single();

    if (orgError) throw orgError;
    if (!organization) {
      throw new Error("Failed to create test organization");
    }

    const organizationId = organization.id;

    // Create location hierarchy node (company) with auto-generate config
    const { data: hierarchyNode, error: hierarchyError } = await supabase
      .from("location_hierarchy")
      .insert({
        organization_id: organizationId,
        name: `Test Company ${testId}`,
        type: "company",
        active: true,
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "weekly",
            day_of_week: 1, // Monday
            time: "09:00",
            grouping: "location",
            require_review: true,
          },
        },
      })
      .select()
      .single();

    if (hierarchyError) throw hierarchyError;
    if (!hierarchyNode) {
      throw new Error("Failed to create test hierarchy node");
    }

    const hierarchyNodeId = hierarchyNode.id;

    // Create test location under hierarchy
    const { data: location, error: locationError } = await supabase
      .from("location")
      .insert({
        organization_id: organizationId,
        name: `Test Location ${testId}`,
        email: `test-location-${testId}@example.com`,
        address: "123 Test Street",
        contact_person: "Test Contact",
        phone: "0412345678",
        hierarchy_parent_id: hierarchyNodeId,
      })
      .select()
      .single();

    if (locationError) throw locationError;
    if (!location) throw new Error("Failed to create test location");

    const locationId = location.id;

    // Create test field configs
    const fieldConfigs = [
      {
        organization_id: organizationId,
        name: "service_type",
        label: "Service Type",
        field_type: "select",
        order_position: 0,
        required: true,
        active: true,
        options: [
          { value: "basic", label: "Basic Service" },
          { value: "premium", label: "Premium Service" },
        ],
      },
      {
        organization_id: organizationId,
        name: "quantity",
        label: "Quantity",
        field_type: "number",
        order_position: 1,
        required: true,
        active: true,
      },
    ];

    const { data: createdFieldConfigs, error: fieldConfigError } =
      await supabase
        .from("organization_field_configs")
        .insert(fieldConfigs)
        .select();

    if (fieldConfigError) throw fieldConfigError;
    if (!createdFieldConfigs || createdFieldConfigs.length === 0) {
      throw new Error("Failed to create test field configs");
    }

    const fieldConfigIds = createdFieldConfigs.map((fc: { id: string }) =>
      fc.id
    );

    // Create an organization_user for authentication in edge functions
    const organizationUserEmail = `test-admin-${testId}@example.com`;
    const { data: orgUser, error: orgUserError } = await supabase
      .from("organization_user")
      .insert({
        organization_id: organizationId,
        email: organizationUserEmail,
        role: "admin",
      })
      .select()
      .single();

    if (orgUserError) {
      console.warn(
        "Failed to create organization_user for tests:",
        orgUserError,
      );
    }

    // Create invoice template config
    await supabase
      .from("invoice_template_config")
      .insert({
        organization_id: organizationId,
        email_recipient_config: {
          location_email_source: "location_email",
          form_field_email: null,
          default_email: null,
        },
      })
      .select()
      .single();

    // Create organization settings with currency
    await supabase
      .from("organization_settings")
      .insert({
        organization_id: organizationId,
        currency: "AUD",
      })
      .select()
      .single();

    return {
      organizationId,
      locationId,
      hierarchyNodeId,
      fieldConfigIds,
      organizationUserEmail: orgUser ? organizationUserEmail : undefined,
    };
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
}

/**
 * Create a test worker
 */
export async function createTestWorker(
  organizationId: string,
): Promise<string> {
  const supabase = await createTestSupabaseClient();

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .insert({
      organization_id: organizationId,
      name: `Test Worker ${Date.now()}`,
      email: `test-worker-${Date.now()}@example.com`,
    })
    .select()
    .single();

  if (workerError) throw workerError;
  if (!worker) throw new Error("Failed to create test worker");

  return worker.id;
}

/**
 * Create a test job with submission data
 */
export async function createTestJob(
  organizationId: string,
  locationId: string,
  _fieldConfigs: Array<{ id: string; name: string }>,
  submissionData: Record<string, unknown>,
  completed: boolean = true,
): Promise<string> {
  const supabase = await createTestSupabaseClient();

  // Create a worker first (required for jobs)
  const workerId = await createTestWorker(organizationId);

  // Create job
  const { data: job, error: jobError } = await supabase
    .from("job")
    .insert({
      organization_id: organizationId,
      location_id: locationId,
      submission_data: submissionData,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (jobError) throw jobError;
  if (!job) throw new Error("Failed to create test job");

  // Link worker to job via job_worker junction table
  const { error: jobWorkerError } = await supabase
    .from("job_worker")
    .insert({
      job_id: job.id,
      worker_id: workerId,
    });

  if (jobWorkerError) throw jobWorkerError;

  return job.id;
}

/**
 * Cleanup test database data in reverse dependency order
 */
export async function cleanupTestDatabase(
  testData: TestDataIds,
): Promise<void> {
  const supabase = await createTestSupabaseClient();

  try {
    // Delete in reverse dependency order

    // 1. Invoices (if exists)
    if (testData.invoiceIds && testData.invoiceIds.length > 0) {
      for (const invoiceId of testData.invoiceIds) {
        // Delete invoice_job records first
        await supabase
          .from("invoice_job")
          .delete()
          .eq("invoice_id", invoiceId);

        // Delete pricing snapshots
        await supabase
          .from("pricing_snapshot")
          .delete()
          .eq("invoice_id", invoiceId);

        // Delete invoice
        await supabase.from("invoice").delete().eq("id", invoiceId);
      }
    }

    // 2. Jobs (if exists)
    if (testData.jobIds && testData.jobIds.length > 0) {
      // Delete job_worker records first
      for (const jobId of testData.jobIds) {
        await supabase.from("job_worker").delete().eq("job_id", jobId);
      }
      await supabase.from("job").delete().in("id", testData.jobIds);
    }

    // 3. Worker (if exists)
    if (testData.workerId) {
      await supabase.from("worker").delete().eq("id", testData.workerId);
    }

    // 4. Pricing rules (if exists)
    if (testData.pricingRuleIds && testData.pricingRuleIds.length > 0) {
      await supabase
        .from("pricing_rule")
        .delete()
        .in("id", testData.pricingRuleIds);
    }

    // 5. Field configs
    if (testData.fieldConfigIds && testData.fieldConfigIds.length > 0) {
      await supabase
        .from("organization_field_configs")
        .delete()
        .in("id", testData.fieldConfigIds);
    }

    // 6. Invoice template config
    await supabase
      .from("invoice_template_config")
      .delete()
      .eq("organization_id", testData.organizationId);

    // 7. Organization settings
    await supabase
      .from("organization_settings")
      .delete()
      .eq("organization_id", testData.organizationId);

    // 8. Location
    await supabase.from("location").delete().eq("id", testData.locationId);

    // 9. Hierarchy node
    if (testData.hierarchyNodeId) {
      await supabase
        .from("location_hierarchy")
        .delete()
        .eq("id", testData.hierarchyNodeId);
    }

    // 10. Organization (this will cascade delete related data)
    await supabase
      .from("organization")
      .delete()
      .eq("id", testData.organizationId);

    console.log("Test database cleanup completed successfully");
  } catch (error) {
    console.error("Error during test database cleanup:", error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}
