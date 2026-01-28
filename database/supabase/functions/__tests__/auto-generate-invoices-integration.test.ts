/**
 * P1 Integration Tests: Auto-Generate Invoices
 *
 * These tests verify the complete end-to-end auto-generate invoices workflow
 * using a real local Supabase database. All test data is cleaned up after tests.
 *
 * Requirements:
 * - Local Supabase running (supabase start)
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * - RESEND_TEST_MODE=true (to prevent sending real emails)
 * - SKIP_EMAIL_SENDING=true (optional, to skip email API calls)
 *
 * Run with: deno test --allow-all --allow-env --allow-net functions/__tests__/auto-generate-invoices-integration.test.ts
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  cleanupTestDatabase,
  createTestJob,
  createTestSupabaseClient,
  createTestWorker,
  setupTestDatabase,
  type TestDataIds,
  wait,
} from "./test-db-helpers.ts";

// Cache a single Supabase client per test run to avoid repeated creations
let supabaseClientPromise: ReturnType<typeof createTestSupabaseClient> | null =
  null;
async function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = createTestSupabaseClient();
  }
  return await supabaseClientPromise;
}

// Preflight check: ensure the edge function is reachable; if not, skip tests
let functionAvailabilityChecked = false;
let functionIsAvailable = false;
async function ensureFunctionAvailable(): Promise<boolean> {
  if (functionAvailabilityChecked) return functionIsAvailable;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not set. Skipping integration tests.",
    );
    functionAvailabilityChecked = true;
    functionIsAvailable = false;
    return false;
  }

  const functionUrl = `${supabaseUrl}/functions/v1/auto-generate-invoices`;
  try {
    // Use OPTIONS with Authorization header (same as actual invocation)
    const res = await fetch(functionUrl, {
      method: "OPTIONS",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    // Always consume the response body to avoid resource leaks
    // Do this before checking status to ensure body is consumed
    const status = res.status;
    await res.text().catch(() => {
      // Ignore errors when consuming body
    });

    // 404 means function not found/not served
    if (status === 404) {
      console.warn(
        "Edge function not served (got 404). Run: supabase functions serve auto-generate-invoices. Skipping integration tests.",
      );
      functionAvailabilityChecked = true;
      functionIsAvailable = false;
      return false;
    }

    // 200 or other non-error status means function is available
    if (status >= 200 && status < 500) {
      functionAvailabilityChecked = true;
      functionIsAvailable = true;
      return true;
    }

    // For any other status, return false
    functionAvailabilityChecked = true;
    functionIsAvailable = false;
    return false;
  } catch (error) {
    if (
      error instanceof TypeError &&
      (error.message.includes("fetch failed") ||
        error.message.includes("Connection refused"))
    ) {
      console.warn(
        "Edge function not reachable. Start Supabase and run: supabase functions serve auto-generate-invoices. Skipping integration tests.",
      );
      functionAvailabilityChecked = true;
      functionIsAvailable = false;
      return false;
    }
    throw error;
  }
}

/**
 * Helper to invoke the auto-generate-invoices edge function via HTTP
 * This tests the function with real database
 *
 * Note: Requires the edge function to be served locally.
 *
 * IMPORTANT: `supabase start` does NOT automatically serve edge functions.
 * You must run this separately:
 *   supabase functions serve auto-generate-invoices
 */
async function invokeAutoGenerateInvoices(): Promise<{
  success: boolean;
  processed: number;
  generated: number;
  errors?: string[];
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is required",
    );
  }

  try {
    // Invoke the edge function via HTTP (requires function to be served)
    const functionUrl = `${supabaseUrl}/functions/v1/auto-generate-invoices`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Function returned error: ${response.status} ${errorText}`,
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    // If function is not served, we'll skip the test with a helpful message
    if (error instanceof TypeError && error.message.includes("fetch failed")) {
      console.warn(
        "⚠️  Edge function not served. Start with: supabase functions serve auto-generate-invoices",
      );
      throw new Error(
        "Edge function not available. Please run: supabase functions serve auto-generate-invoices",
      );
    }
    throw error;
  }
}

// ============================================================================
// P1.1: Complete Auto-Generate Flow (Happy Path)
// ============================================================================

Deno.test("P1.1.1: should create invoices from completed jobs with pending_review status", async () => {
  let testData: TestDataIds | null = null;

  try {
    // Setup test database
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Create completed jobs
    const job1 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      {
        service_type: "basic",
        quantity: 2,
      },
      true, // completed
    );

    const job2 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      {
        service_type: "premium",
        quantity: 1,
      },
      true, // completed
    );

    testData.jobIds = [job1, job2];

    // Wait a moment for jobs to be fully created
    await wait(500);

    // Invoke auto-generate-invoices function
    // Note: We need to mock the time to be Monday 09:00 for the schedule to trigger
    // For now, we'll manually set the hierarchy metadata to trigger immediately
    // by using a daily schedule that should run at the current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeString = `${currentHour.toString().padStart(2, "0")}:${
      currentMinute.toString().padStart(2, "0")
    }`;

    // Update hierarchy to use daily schedule at current time
    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Invoke the function
    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true, "Function should indicate success");
    assertExists(result.generated, "Should have generated count");

    // Wait a moment for invoices to be created
    await wait(1000);

    // Verify invoices were created
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoice")
      .select("*")
      .eq("organization_id", testData.organizationId)
      .eq("status", "pending_review");

    if (invoiceError) throw invoiceError;

    // Should have at least one invoice
    assertExists(invoices, "Invoices should exist");
    assertEquals(
      invoices.length > 0,
      true,
      "Should have created at least one invoice",
    );

    // Store invoice IDs for cleanup
    testData.invoiceIds = invoices.map((inv: { id: string }) => inv.id);

    // Verify invoice_job records were created
    const { data: invoiceJobs, error: invoiceJobError } = await supabase
      .from("invoice_job")
      .select("*")
      .in("invoice_id", testData.invoiceIds);

    if (invoiceJobError) throw invoiceJobError;
    assertExists(invoiceJobs, "Invoice jobs should exist");
    assertEquals(
      invoiceJobs.length,
      2,
      "Should have created invoice_job records for both jobs",
    );

    // Verify invoice numbers are sequential
    const invoiceNumbers = invoices.map((inv: { invoice_number: string }) =>
      inv.invoice_number
    ).sort();
    if (invoiceNumbers.length > 1) {
      // Check that numbers are unique
      const uniqueNumbers = new Set(invoiceNumbers);
      assertEquals(
        uniqueNumbers.size,
        invoiceNumbers.length,
        "Invoice numbers should be unique",
      );
    }
  } finally {
    // Cleanup
    if (testData) {
      await cleanupTestDatabase(testData);
    }
  }
});

// ============================================================================
// P1.2: No Jobs to Invoice
// ============================================================================

Deno.test("P1.2.1: should not create invoices when no completed jobs exist", async () => {
  let testData: TestDataIds | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Don't create any jobs - hierarchy has no completed jobs

    // Update hierarchy to use daily schedule
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeString = `${currentHour.toString().padStart(2, "0")}:${
      currentMinute.toString().padStart(2, "0")
    }`;

    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Invoke the function
    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true, "Function should indicate success");
    assertEquals(
      result.generated,
      0,
      "Should not have generated any invoices",
    );

    // Verify no invoices were created
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoice")
      .select("*")
      .eq("organization_id", testData.organizationId);

    if (invoiceError) throw invoiceError;
    assertEquals(
      invoices?.length || 0,
      0,
      "Should not have created any invoices",
    );
  } finally {
    if (testData) {
      await cleanupTestDatabase(testData);
    }
  }
});

// ============================================================================
// P1.3: All Jobs Already Invoiced
// ============================================================================

Deno.test("P1.3.1: should not create duplicate invoices for already invoiced jobs", async () => {
  let testData: TestDataIds | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Create completed jobs
    const job1 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      {
        service_type: "basic",
        quantity: 1,
      },
      true,
    );

    testData.jobIds = [job1];

    // Manually create an invoice for the job
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .insert({
        organization_id: testData.organizationId,
        invoice_number: `TEST-${Date.now()}-0001`,
        status: "draft",
        subtotal: 100,
        total: 100,
        currency: "AUD",
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString(),
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error("Failed to create test invoice");

    testData.invoiceIds = [invoice.id];

    // Link job to invoice
    await supabase.from("invoice_job").insert({
      invoice_id: invoice.id,
      job_id: job1,
    });

    // Update hierarchy to use daily schedule
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeString = `${currentHour.toString().padStart(2, "0")}:${
      currentMinute.toString().padStart(2, "0")
    }`;

    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Invoke the function
    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true, "Function should indicate success");
    assertEquals(
      result.generated,
      0,
      "Should not have generated duplicate invoices",
    );

    // Verify only one invoice exists (the manually created one)
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoice")
      .select("*")
      .eq("organization_id", testData.organizationId);

    if (invoicesError) throw invoicesError;
    assertEquals(
      invoices?.length || 0,
      1,
      "Should only have the manually created invoice",
    );
  } finally {
    if (testData) {
      await cleanupTestDatabase(testData);
    }
  }
});

// ============================================================================
// P1.4: Partial Jobs Already Invoiced
// ============================================================================

Deno.test("P1.4.1: should create invoice only for uninvoiced jobs", async () => {
  let testData: TestDataIds | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Create 3 completed jobs
    const job1 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "basic", quantity: 1 },
      true,
    );

    const job2 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "premium", quantity: 1 },
      true,
    );

    const job3 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "basic", quantity: 2 },
      true,
    );

    testData.jobIds = [job1, job2, job3];

    // Manually invoice job1 and job2
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .insert({
        organization_id: testData.organizationId,
        invoice_number: `TEST-${Date.now()}-0001`,
        status: "draft",
        subtotal: 200,
        total: 200,
        currency: "AUD",
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString(),
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error("Failed to create test invoice");

    testData.invoiceIds = [invoice.id];

    // Link job1 and job2 to invoice
    await supabase.from("invoice_job").insert([
      { invoice_id: invoice.id, job_id: job1 },
      { invoice_id: invoice.id, job_id: job2 },
    ]);

    // Update hierarchy to use daily schedule
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeString = `${currentHour.toString().padStart(2, "0")}:${
      currentMinute.toString().padStart(2, "0")
    }`;

    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Invoke the function
    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true, "Function should indicate success");

    // Wait for invoice creation
    await wait(1000);

    // Verify new invoice was created for job3 only
    const { data: newInvoices, error: newInvoicesError } = await supabase
      .from("invoice")
      .select("*")
      .eq("organization_id", testData.organizationId)
      .eq("status", "pending_review");

    if (newInvoicesError) throw newInvoicesError;
    assertExists(newInvoices, "New invoices should exist");
    assertEquals(
      newInvoices.length,
      1,
      "Should have created one new invoice for uninvoiced job",
    );

    // Verify the new invoice only contains job3
    const { data: newInvoiceJobs, error: newInvoiceJobsError } = await supabase
      .from("invoice_job")
      .select("*")
      .eq("invoice_id", newInvoices[0].id);

    if (newInvoiceJobsError) throw newInvoiceJobsError;
    assertEquals(
      newInvoiceJobs?.length,
      1,
      "New invoice should only contain one job",
    );
    assertEquals(
      newInvoiceJobs?.[0].job_id,
      job3,
      "New invoice should contain job3",
    );

    // Update testData for cleanup
    testData.invoiceIds = [invoice.id, newInvoices[0].id];
  } finally {
    if (testData) {
      await cleanupTestDatabase(testData);
    }
  }
});

// ============================================================================
// P1.5: Invoice Status Based on require_review Setting
// ============================================================================

Deno.test("P1.5.1: should create draft invoice when require_review is false", async () => {
  let testData: TestDataIds | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Create completed job
    const job1 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "basic", quantity: 1 },
      true,
    );

    testData.jobIds = [job1];

    // Update hierarchy with require_review: false
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeString = `${currentHour.toString().padStart(2, "0")}:${
      currentMinute.toString().padStart(2, "0")
    }`;

    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: false, // Key difference
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Invoke the function
    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true, "Function should indicate success");

    // Wait for invoice creation
    await wait(1000);

    // Verify invoice was created with draft status
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoice")
      .select("*")
      .eq("organization_id", testData.organizationId)
      .eq("status", "draft");

    if (invoicesError) throw invoicesError;
    assertExists(invoices, "Invoices should exist");
    assertEquals(
      invoices.length,
      1,
      "Should have created one draft invoice",
    );

    testData.invoiceIds = invoices.map((inv: { id: string }) => inv.id);
  } finally {
    if (testData) {
      await cleanupTestDatabase(testData);
    }
  }
});

// ============================================================================
// P1.6: All Together Grouping
// ============================================================================

Deno.test("P1.6.1: should create single invoice for all jobs when grouping is 'all'", async () => {
  let testData: TestDataIds | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Create multiple completed jobs at different locations
    const job1 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "basic", quantity: 1 },
      true,
    );

    // Create a second location and job
    const { data: location2 } = await supabase
      .from("location")
      .insert({
        organization_id: testData.organizationId,
        name: "Test Location 2",
        email: "location2@test.com",
        hierarchy_parent_id: testData.hierarchyNodeId,
      })
      .select()
      .single();

    const job2 = await createTestJob(
      testData.organizationId,
      location2.id,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "premium", quantity: 2 },
      true,
    );

    // Configure auto-generate with "all" grouping
    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: "09:00",
            grouping: "all",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Set time to trigger auto-generate
    const now = new Date();
    now.setHours(9);
    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);

    // Invoke auto-generate
    const result = await invokeAutoGenerateInvoices();

    assertEquals(result.success, true);
    assertEquals(result.generated, 1); // Should create only 1 invoice for all jobs

    // Verify invoice was created with both jobs
    const { data: invoices } = await supabase
      .from("invoice")
      .select("*, invoice_job(*)")
      .eq("organization_id", testData.organizationId)
      .eq("status", "pending_review");

    assertExists(invoices);
    assertEquals(invoices.length, 1);
    assertEquals(invoices[0].invoice_job.length, 2); // Both jobs in one invoice

    // Verify both jobs are linked
    const jobIds = invoices[0].invoice_job.map((ij: { job_id: string }) =>
      ij.job_id
    );
    assertEquals(jobIds.includes(job1), true);
    assertEquals(jobIds.includes(job2), true);
  } finally {
    if (testData) await cleanupTestDatabase(testData);
  }
});

// ============================================================================
// P1.6.2: Location grouping – one invoice per location
// ============================================================================

Deno.test("P1.6.2: should create separate invoices per location when grouping is 'location'", async () => {
  let testData: TestDataIds | null = null;
  let location2Id: string | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Job at first location (testData.locationId)
    const job1 = await createTestJob(
      testData.organizationId,
      testData.locationId,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "basic", quantity: 1 },
      true,
    );

    // Second location under same hierarchy node
    const { data: location2, error: loc2Error } = await supabase
      .from("location")
      .insert({
        organization_id: testData.organizationId,
        name: "Test Location 2",
        email: "location2@test.com",
        hierarchy_parent_id: testData.hierarchyNodeId,
      })
      .select()
      .single();

    if (loc2Error) throw loc2Error;
    if (!location2) throw new Error("Failed to create second location");
    location2Id = location2.id;

    const job2 = await createTestJob(
      testData.organizationId,
      location2.id,
      testData.fieldConfigIds.map((id) => ({ id, name: "service_type" })),
      { service_type: "premium", quantity: 2 },
      true,
    );

    testData.jobIds = [job1, job2];

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true);
    assertEquals(
      result.generated,
      2,
      "Should create one invoice per location when grouping is 'location'",
    );

    await wait(1000);

    const { data: invoices, error: invErr } = await supabase
      .from("invoice")
      .select("*, invoice_job(*)")
      .eq("organization_id", testData.organizationId)
      .eq("status", "pending_review");

    if (invErr) throw invErr;
    assertExists(invoices);
    assertEquals(
      invoices.length,
      2,
      "Should have exactly two invoices (one per location)",
    );

    const jobCounts = invoices.map(
      (inv: { invoice_job: unknown[] }) => inv.invoice_job?.length ?? 0,
    );
    assertEquals(
      jobCounts.every((n: number) => n === 1),
      true,
      "Each invoice should contain exactly one job",
    );

    const allJobIds = invoices.flatMap(
      (inv: { invoice_job: Array<{ job_id: string }> }) =>
        (inv.invoice_job ?? []).map((ij: { job_id: string }) => ij.job_id),
    );
    assertEquals(allJobIds.includes(job1), true);
    assertEquals(allJobIds.includes(job2), true);

    testData.invoiceIds = invoices.map((inv: { id: string }) => inv.id);
  } finally {
    if (testData) {
      if (location2Id) {
        const supabase = await getSupabaseClient();
        await supabase.from("location").delete().eq("id", location2Id);
      }
      await cleanupTestDatabase(testData);
    }
  }
});

// ============================================================================
// P1.7: Jobs with Null Location ID
// ============================================================================
// ============================================================================

Deno.test("P1.7.1: should handle jobs with null location_id gracefully", async () => {
  let testData: TestDataIds | null = null;

  try {
    testData = await setupTestDatabase();
    const available = await ensureFunctionAvailable();
    if (!available) return;
    const supabase = await getSupabaseClient();

    // Create a worker first
    const workerId = await createTestWorker(testData.organizationId);
    testData.workerId = workerId;

    // Create job with null location_id
    const { data: job, error: jobError } = await supabase
      .from("job")
      .insert({
        organization_id: testData.organizationId,
        location_id: null, // Null location
        submission_data: { service_type: "basic", quantity: 1 },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;
    if (!job) throw new Error("Failed to create test job");

    testData.jobIds = [job.id];

    // Link worker
    await supabase.from("job_worker").insert({
      job_id: job.id,
      worker_id: workerId,
    });

    // Update hierarchy to use daily schedule
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeString = `${currentHour.toString().padStart(2, "0")}:${
      currentMinute.toString().padStart(2, "0")
    }`;

    await supabase
      .from("location_hierarchy")
      .update({
        metadata: {
          auto_generate_invoices: {
            enabled: true,
            period: "daily",
            time: timeString,
            grouping: "location",
            require_review: true,
          },
        },
      })
      .eq("id", testData.hierarchyNodeId);

    // Invoke the function - should not error, but may not create invoice
    // since job has null location_id and isn't under the hierarchy
    const result = await invokeAutoGenerateInvoices();
    assertEquals(result.success, true, "Function should indicate success");

    // Function should complete without errors even with null location_id
    // (job won't be included since it's not under the hierarchy)
  } finally {
    if (testData) {
      await cleanupTestDatabase(testData);
    }
  }
});
