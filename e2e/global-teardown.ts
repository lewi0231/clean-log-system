/**
 * Global Teardown for E2E Tests
 *
 * This file runs after all tests and:
 * 1. Cleans up all seeded test data from the database
 * 2. Removes temporary auth state files
 */

import * as fs from "fs";
import * as path from "path";

import { cleanupScenario1, resetSupabaseClient } from "./helpers/db-seeder";
import type { SeededDataIds } from "./helpers/types";

// Path to stored seeded data IDs
const SEEDED_DATA_PATH = path.resolve(__dirname, ".seeded-data.json");
const AUTH_STATE_PATH = path.resolve(__dirname, ".auth/user.json");

async function globalTeardown(): Promise<void> {
  console.log("\n🧹 Starting Global Teardown...\n");

  // 1. Load seeded data IDs
  let seededIds: SeededDataIds | null = null;

  if (fs.existsSync(SEEDED_DATA_PATH)) {
    try {
      const data = fs.readFileSync(SEEDED_DATA_PATH, "utf-8");
      seededIds = JSON.parse(data) as SeededDataIds;
      console.log(`📖 Loaded seeded data IDs (testId: ${seededIds.testId})`);
    } catch (error) {
      console.warn("⚠️ Failed to load seeded data IDs:", error);
    }
  } else {
    console.warn("⚠️ No seeded data file found - skipping database cleanup");
  }

  // 2. Clean up database
  if (seededIds) {
    console.log("\n🗑️ Cleaning up database...");
    try {
      await cleanupScenario1(seededIds);
      console.log("✅ Database cleanup completed");
    } catch (error) {
      console.error("❌ Database cleanup failed:", error);
      // Don't throw - we still want to clean up files
    }
  }

  // 3. Remove temporary files
  console.log("\n📁 Removing temporary files...");

  const filesToRemove = [SEEDED_DATA_PATH, AUTH_STATE_PATH];

  for (const filePath of filesToRemove) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`  Removed: ${path.basename(filePath)}`);
      } catch (error) {
        console.warn(`  ⚠️ Failed to remove ${path.basename(filePath)}:`, error);
      }
    }
  }

  // Remove auth directory if empty
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (fs.existsSync(authDir)) {
    try {
      const files = fs.readdirSync(authDir);
      if (files.length === 0) {
        fs.rmdirSync(authDir);
        console.log("  Removed: .auth directory");
      }
    } catch {
      // Ignore errors removing empty directory
    }
  }

  // 4. Reset Supabase client
  resetSupabaseClient();

  console.log("\n✅ Global Teardown completed!\n");
}

export default globalTeardown;
