/**
 * Test database helpers for integration tests
 *
 * These helpers create and clean up test data in a real local Supabase database.
 * They use the service role key to bypass RLS for test setup/teardown.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

export interface TestDataIds {
    organizationId: string;
    locationId: string;
    fieldConfigIds: string[];
    pricingRuleIds?: string[];
    jobId?: string;
    invoiceId?: string;
    paymentLinkId?: string;
    paymentId?: string;
}

/**
 * Create a Supabase client with service role key for test database operations
 */
function createTestSupabaseClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL is required for integration tests. Set it to http://localhost:54321 for local Supabase.",
        );
    }

    if (!serviceRoleKey) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is required for integration tests. Get it from 'supabase status' command.",
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Wait for a specified amount of time (for async operations)
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Setup test database with organization, location, and field configs
 */
export async function setupTestDatabase(): Promise<TestDataIds> {
    const supabase = createTestSupabaseClient();
    const testId = `test_${Date.now()}_${
        Math.random().toString(36).substring(7)
    }`;

    try {
        // Create test organization
        const { data: organization, error: orgError } = await supabase
            .from("organization")
            .insert({
                name: `Test Organization ${testId}`,
                org_code: `TEST${testId.substring(0, 8).toUpperCase()}`,
                use_predefined_locations: true,
            })
            .select()
            .single();

        if (orgError) throw orgError;
        if (!organization) {
            throw new Error("Failed to create test organization");
        }

        const organizationId = organization.id;

        // Create test location
        const { data: location, error: locationError } = await supabase
            .from("location")
            .insert({
                organization_id: organizationId,
                name: `Test Location ${testId}`,
                email: `test-location-${testId}@example.com`,
                address: "123 Test Street",
                contact_person: "Test Contact",
                phone: "0412345678",
            })
            .select()
            .single();

        if (locationError) throw locationError;
        if (!location) throw new Error("Failed to create test location");

        const locationId = location.id;

        // Create test field configs with pricing options
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

        const fieldConfigIds = createdFieldConfigs.map((fc) => fc.id);

        // Create invoice template config with email recipient config
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
            fieldConfigIds,
        };
    } catch (error) {
        console.error("Error setting up test database:", error);
        throw error;
    }
}

/**
 * Create a test job with submission data
 */
export async function createTestJob(
    organizationId: string,
    locationId: string,
    fieldConfigs: Array<{ id: string; name: string }>,
    submissionData: Record<string, unknown>,
): Promise<string> {
    const supabase = createTestSupabaseClient();

    // Create a worker first (required for jobs)
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

    // Create job
    const { data: job, error: jobError } = await supabase
        .from("job")
        .insert({
            organization_id: organizationId,
            location_id: locationId,
            worker_id: worker.id,
            submission_data: submissionData,
            completed_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (jobError) throw jobError;
    if (!job) throw new Error("Failed to create test job");

    return job.id;
}

/**
 * Cleanup test database data in reverse dependency order
 */
export async function cleanupTestDatabase(
    testData: TestDataIds,
): Promise<void> {
    const supabase = createTestSupabaseClient();

    try {
        // Delete in reverse dependency order
        // 1. Payments (if exists)
        if (testData.paymentId) {
            await supabase.from("payment").delete().eq(
                "id",
                testData.paymentId,
            );
        }

        // 2. Payment links (if exists)
        if (testData.paymentLinkId) {
            await supabase
                .from("payment_link")
                .delete()
                .eq("id", testData.paymentLinkId);
        }

        // 3. Invoices (if exists)
        if (testData.invoiceId) {
            // Delete invoice_job records first
            await supabase
                .from("invoice_job")
                .delete()
                .eq("invoice_id", testData.invoiceId);

            // Delete pricing snapshots
            await supabase
                .from("pricing_snapshot")
                .delete()
                .eq("invoice_id", testData.invoiceId);

            // Delete invoice
            await supabase.from("invoice").delete().eq(
                "id",
                testData.invoiceId,
            );
        }

        // 4. Jobs (if exists)
        if (testData.jobId) {
            await supabase.from("job").delete().eq("id", testData.jobId);
        }

        // 5. Pricing rules (if exists)
        if (testData.pricingRuleIds && testData.pricingRuleIds.length > 0) {
            await supabase
                .from("pricing_rule")
                .delete()
                .in("id", testData.pricingRuleIds);
        }

        // 6. Field configs
        if (testData.fieldConfigIds && testData.fieldConfigIds.length > 0) {
            await supabase
                .from("organization_field_configs")
                .delete()
                .in("id", testData.fieldConfigIds);
        }

        // 7. Invoice template config
        await supabase
            .from("invoice_template_config")
            .delete()
            .eq("organization_id", testData.organizationId);

        // 8. Organization settings
        await supabase
            .from("organization_settings")
            .delete()
            .eq("organization_id", testData.organizationId);

        // 9. Location
        await supabase.from("location").delete().eq("id", testData.locationId);

        // 10. Organization (this will cascade delete related data)
        await supabase
            .from("organization")
            .delete()
            .eq("id", testData.organizationId);

        console.log("Test database cleanup completed successfully");
    } catch (error) {
        console.error("Error during test database cleanup:", error);
        // Don't throw - cleanup errors shouldn't fail tests
        // But log them for debugging
    }
}
