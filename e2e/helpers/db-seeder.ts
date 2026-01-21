/**
 * Database seeder for E2E Playwright tests
 *
 * Creates and cleans up test data in a real local Supabase database.
 * Uses service role key to bypass RLS for test setup/teardown.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import type { Scenario1Data, SeededDataIds } from "./types";

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

/**
 * Get service role key from supabase status command
 */
function getServiceRoleKeyFromStatus(): string | null {
  try {
    const databaseDir = path.resolve(__dirname, "../../database");

    // Try JSON output first
    try {
      const output = execSync("supabase status --output json", {
        cwd: databaseDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      const status = JSON.parse(output);
      // Check various possible key locations (Supabase CLI versions vary)
      const possiblePaths = [
        status?.SERVICE_ROLE_KEY, // Current CLI format (uppercase)
        status?.service_role_key, // Lowercase variant
        status?.DB?.service_role_key,
        status?.db?.service_role_key,
      ];

      for (const key of possiblePaths) {
        if (key && typeof key === "string" && key.startsWith("eyJ")) {
          return key;
        }
      }
    } catch {
      // JSON parsing failed, try text output
    }

    // Fallback to text parsing
    const output = execSync("supabase status", {
      cwd: databaseDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const patterns = [
      /service_role key:\s*([^\s\n]+)/i,
      /service_role_key:\s*([^\s\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match?.[1]?.startsWith("eyJ")) {
        return match[1].trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create or get Supabase client with service role key
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || "http://localhost:54321";
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.log("Attempting to get service role key from supabase status...");
    serviceRoleKey = getServiceRoleKeyFromStatus() ?? undefined;

    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required.\n" +
          "Run: cd database && supabase status\n" +
          "Then set SUPABASE_SERVICE_ROLE_KEY environment variable",
      );
    }
    console.log("Got service role key from supabase status");
  }

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Load scenario data from JSON file
 */
export function loadScenarioData(): Scenario1Data {
  const dataPath = path.resolve(__dirname, "../data/scenario-1.json");
  const data = fs.readFileSync(dataPath, "utf-8");
  return JSON.parse(data) as Scenario1Data;
}

/**
 * Seed Scenario 1 data into the database
 */
export async function seedScenario1(): Promise<SeededDataIds> {
  const supabase = getSupabaseClient();
  const data = loadScenarioData();
  const testId = `e2e_${Date.now()}`;

  console.log(`Seeding Scenario 1 data (testId: ${testId})...`);

  const seededIds: SeededDataIds = {
    testId,
    organizationId: "",
    adminUserId: "",
    hierarchyNodeId: "",
    locationIds: {},
    workerIds: {},
    fieldConfigIds: {},
    pricingRuleIds: [],
    rateCardIds: [],
  };

  try {
    // 1. Create organization (with onboarding marked as complete to skip onboarding flow)
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .insert({
        name: `${data.organization.name} (${testId})`,
        org_code: `${data.organization.org_code}${
          Date.now().toString(36).slice(-4).toUpperCase()
        }`,
        use_predefined_locations: data.organization.use_predefined_locations,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_data: {
          industry_type: "automotive",
          employee_count: "6-10",
          has_locations: true,
          worker_payment_method: "bank_transfer",
          worker_payment_frequency: "weekly",
          invoice_frequency: "per_job",
          review_invoices_before_sending: false,
        },
      })
      .select()
      .single();

    if (orgError) {
      throw new Error(`Failed to create organization: ${orgError.message}`);
    }
    seededIds.organizationId = org.id;
    console.log(`  Created organization: ${org.name} (onboarding complete)`);

    // 2. Create organization settings (minimal - currency is stored elsewhere)
    const { error: settingsError } = await supabase
      .from("organization_settings")
      .insert({
        organization_id: org.id,
      });

    if (settingsError) {
      console.warn(
        `  Warning: Failed to create organization settings: ${settingsError.message}`,
      );
    } else {
      console.log("  Created organization settings");
    }

    // 3. Create invoice template config
    await supabase.from("invoice_template_config").insert({
      organization_id: org.id,
      email_recipient_config: {
        location_email_source: "location_email",
      },
    });

    // 4. Create admin auth user (bypassing email verification)
    const { data: adminAuth, error: adminAuthError } = await supabase.auth.admin
      .createUser({
        email: data.admin.email.replace("@", `+${testId}@`),
        password: data.admin.password,
        email_confirm: true,
        user_metadata: {
          role: "admin",
          first_name: data.admin.first_name,
          last_name: data.admin.last_name,
        },
      });

    if (adminAuthError) {
      throw new Error(`Failed to create admin user: ${adminAuthError.message}`);
    }
    seededIds.adminUserId = adminAuth.user.id;
    seededIds.adminEmail = data.admin.email.replace("@", `+${testId}@`);
    console.log(`  Created admin auth user: ${seededIds.adminEmail}`);

    // 5. Create organization_user for admin (no auth_user_id column - auth is handled separately)
    const { error: orgUserError } = await supabase.from("organization_user")
      .insert({
        organization_id: org.id,
        email: seededIds.adminEmail,
        role: "admin",
      });

    if (orgUserError) {
      throw new Error(
        `Failed to create organization_user: ${orgUserError.message}`,
      );
    }
    console.log("  Created organization_user for admin");

    // 6. Create location hierarchy (parent company)
    const { data: hierarchy, error: hierarchyError } = await supabase
      .from("location_hierarchy")
      .insert({
        organization_id: org.id,
        name: `${data.locationHierarchy.name} (${testId})`,
        type: data.locationHierarchy.type,
        active: true,
        metadata: data.locationHierarchy.metadata,
      })
      .select()
      .single();

    if (hierarchyError) {
      throw new Error(`Failed to create hierarchy: ${hierarchyError.message}`);
    }
    seededIds.hierarchyNodeId = hierarchy.id;
    console.log(`  Created hierarchy: ${hierarchy.name}`);

    // 7. Create locations
    for (const loc of data.locations) {
      const { data: location, error: locError } = await supabase
        .from("location")
        .insert({
          organization_id: org.id,
          name: loc.name,
          email: loc.email.replace("@", `+${testId}@`),
          address: loc.address,
          contact_person: loc.contact_person,
          phone: loc.phone,
          hierarchy_parent_id: loc.hierarchy_parent ? hierarchy.id : null,
        })
        .select()
        .single();

      if (locError) {
        throw new Error(
          `Failed to create location ${loc.name}: ${locError.message}`,
        );
      }
      seededIds.locationIds[loc.id] = location.id;
      console.log(`  Created location: ${location.name}`);
    }

    // 8. Create field configs
    for (const field of data.fieldConfigs) {
      const { data: fieldConfig, error: fieldError } = await supabase
        .from("organization_field_configs")
        .insert({
          organization_id: org.id,
          name: field.name,
          label: field.label,
          field_type: field.field_type,
          description: field.description,
          required: field.required,
          order_position: field.order_position,
          mutually_exclusive_group: field.mutually_exclusive_group,
          options: field.options,
          validation_rules: field.validation_rules || null,
          active: true,
        })
        .select()
        .single();

      if (fieldError) {
        throw new Error(
          `Failed to create field config ${field.name}: ${fieldError.message}`,
        );
      }
      seededIds.fieldConfigIds[field.id] = fieldConfig.id;
      console.log(`  Created field config: ${fieldConfig.name}`);
    }

    // 9. Create workers (all active, bypassing invitation flow)
    for (const worker of data.workers) {
      // Create auth user for worker
      const workerEmail = worker.email.replace("@", `+${testId}@`);
      const { data: workerAuth, error: workerAuthError } = await supabase.auth
        .admin.createUser({
          email: workerEmail,
          password: data.testCredentials.defaultPassword,
          email_confirm: true,
          user_metadata: {
            role: "worker",
          },
        });

      if (workerAuthError) {
        console.warn(
          `  Warning: Failed to create worker auth: ${workerAuthError.message}`,
        );
        continue;
      }

      // Create worker record
      const { data: workerRecord, error: workerError } = await supabase
        .from("worker")
        .insert({
          organization_id: org.id,
          first_name: worker.first_name,
          last_name: worker.last_name,
          name: `${worker.first_name} ${worker.last_name}`,
          email: workerEmail,
          phone: worker.phone,
          active: true,
          auth_user_id: workerAuth.user.id,
        })
        .select()
        .single();

      if (workerError) {
        console.warn(
          `  Warning: Failed to create worker ${worker.first_name}: ${workerError.message}`,
        );
        continue;
      }

      seededIds.workerIds[worker.id] = workerRecord.id;
      console.log(`  Created worker: ${workerRecord.name} (${worker.role})`);
    }

    // 10. Create pricing rules
    for (const rule of data.pricingRules) {
      const fieldConfigId = rule.field_config_name
        ? seededIds.fieldConfigIds[
          Object.keys(seededIds.fieldConfigIds).find((k) =>
            data.fieldConfigs.find((f) => f.id === k)?.name ===
              rule.field_config_name
          ) ?? ""
        ]
        : null;

      const locationId = rule.location_name
        ? seededIds.locationIds[
          Object.keys(seededIds.locationIds).find((k) =>
            data.locations.find((l) => l.id === k)?.name === rule.location_name
          ) ?? ""
        ]
        : null;

      const { data: pricingRule, error: priceError } = await supabase
        .from("pricing_rule")
        .insert({
          organization_id: org.id,
          scope: rule.scope,
          pricing_type: rule.pricing_type,
          field_config_id: fieldConfigId,
          location_id: locationId,
          base_price: rule.base_price || null,
          percentage_rate: rule.percentage_rate || null,
          currency: rule.currency,
          priority: rule.priority,
          active: rule.active,
          metadata: { description: rule.description },
        })
        .select()
        .single();

      if (priceError) {
        console.warn(
          `  Warning: Failed to create pricing rule ${rule.name}: ${priceError.message}`,
        );
        continue;
      }

      seededIds.pricingRuleIds.push(pricingRule.id);
      console.log(`  Created pricing rule: ${rule.name}`);
    }

    // 11. Create rate cards for supervisor
    // Schema: worker_rate_card has modifier_type (per_unit, flat, multiplier, team_percentage)
    // and modifier_value. Field configs are linked via worker_rate_card_field table.
    const supervisorData = data.rateCards.supervisor;
    const supervisorWorkerId = seededIds.workerIds["worker-1"]; // Sarah Mitchell

    if (supervisorWorkerId && supervisorData) {
      for (const card of supervisorData.cards) {
        // Map rate_type to modifier_type
        let modifierType: string;
        let modifierValue: number;

        if (card.rate_type === "unit") {
          modifierType = "per_unit";
          modifierValue = card.base_amount || 0;
        } else if (card.rate_type === "percentage") {
          modifierType = card.modifier_type || "multiplier";
          modifierValue = card.percentage_rate || 0;
        } else {
          modifierType = "flat";
          modifierValue = card.base_amount || 0;
        }

        // Skip if no valid modifier value
        if (modifierValue <= 0) {
          console.warn(
            `  Warning: Skipping rate card ${card.name}: modifier_value must be > 0`,
          );
          continue;
        }

        const { data: rateCard, error: rateError } = await supabase
          .from("worker_rate_card")
          .insert({
            organization_id: org.id,
            worker_id: supervisorWorkerId,
            modifier_type: modifierType,
            modifier_value: modifierValue,
            is_active: true,
            effective_from: new Date().toISOString().split("T")[0], // Date only
            notes: card.description,
          })
          .select()
          .single();

        if (rateError) {
          console.warn(
            `  Warning: Failed to create rate card ${card.name}: ${rateError.message}`,
          );
          continue;
        }

        // Link to field config if specified
        if (card.field_config_name) {
          const fieldConfigId = seededIds.fieldConfigIds[
            Object.keys(seededIds.fieldConfigIds).find((k) =>
              data.fieldConfigs.find((f) => f.id === k)?.name ===
                card.field_config_name
            ) ?? ""
          ];

          if (fieldConfigId) {
            const { error: fieldLinkError } = await supabase
              .from("worker_rate_card_field")
              .insert({
                rate_card_id: rateCard.id,
                field_config_id: fieldConfigId,
              });

            if (fieldLinkError) {
              console.warn(
                `  Warning: Failed to link field config to rate card: ${fieldLinkError.message}`,
              );
            }
          }
        }

        seededIds.rateCardIds.push(rateCard.id);
        console.log(`  Created rate card: ${card.name} for supervisor`);
      }
    }

    console.log("Scenario 1 seeding completed successfully!");
    return seededIds;
  } catch (error) {
    console.error("Error seeding Scenario 1:", error);
    // Attempt cleanup on failure
    await cleanupScenario1(seededIds);
    throw error;
  }
}

/**
 * Clean up all Scenario 1 test data
 */
export async function cleanupScenario1(
  seededIds: SeededDataIds,
): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`Cleaning up Scenario 1 data (testId: ${seededIds.testId})...`);

  try {
    // Delete in reverse dependency order

    // 1. Rate cards
    if (seededIds.rateCardIds.length > 0) {
      await supabase.from("worker_rate_card").delete().in(
        "id",
        seededIds.rateCardIds,
      );
      console.log(`  Deleted ${seededIds.rateCardIds.length} rate cards`);
    }

    // 2. Pricing rules
    if (seededIds.pricingRuleIds.length > 0) {
      await supabase.from("pricing_rule").delete().in(
        "id",
        seededIds.pricingRuleIds,
      );
      console.log(`  Deleted ${seededIds.pricingRuleIds.length} pricing rules`);
    }

    // 3. Workers (delete auth users first)
    for (const [key, workerId] of Object.entries(seededIds.workerIds)) {
      // Get worker's auth_user_id
      const { data: worker } = await supabase
        .from("worker")
        .select("auth_user_id")
        .eq("id", workerId)
        .single();

      if (worker?.auth_user_id) {
        await supabase.auth.admin.deleteUser(worker.auth_user_id);
      }

      await supabase.from("worker").delete().eq("id", workerId);
      console.log(`  Deleted worker: ${key}`);
    }

    // 4. Field configs
    const fieldConfigIdValues = Object.values(seededIds.fieldConfigIds);
    if (fieldConfigIdValues.length > 0) {
      await supabase.from("organization_field_configs").delete().in(
        "id",
        fieldConfigIdValues,
      );
      console.log(`  Deleted ${fieldConfigIdValues.length} field configs`);
    }

    // 5. Locations
    const locationIdValues = Object.values(seededIds.locationIds);
    if (locationIdValues.length > 0) {
      await supabase.from("location").delete().in("id", locationIdValues);
      console.log(`  Deleted ${locationIdValues.length} locations`);
    }

    // 6. Hierarchy
    if (seededIds.hierarchyNodeId) {
      await supabase.from("location_hierarchy").delete().eq(
        "id",
        seededIds.hierarchyNodeId,
      );
      console.log("  Deleted hierarchy node");
    }

    // 7. Organization settings & invoice config
    if (seededIds.organizationId) {
      await supabase.from("invoice_template_config").delete().eq(
        "organization_id",
        seededIds.organizationId,
      );
      await supabase.from("organization_settings").delete().eq(
        "organization_id",
        seededIds.organizationId,
      );
    }

    // 8. Organization user & admin auth
    if (seededIds.adminUserId) {
      await supabase.from("organization_user").delete().eq(
        "auth_user_id",
        seededIds.adminUserId,
      );
      await supabase.auth.admin.deleteUser(seededIds.adminUserId);
      console.log("  Deleted admin user");
    }

    // 9. Organization
    if (seededIds.organizationId) {
      await supabase.from("organization").delete().eq(
        "id",
        seededIds.organizationId,
      );
      console.log("  Deleted organization");
    }

    console.log("Cleanup completed successfully!");
  } catch (error) {
    console.error("Error during cleanup:", error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Reset Supabase client
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}
