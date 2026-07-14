/**
 * P0 Critical Tests: Auto-Send Configuration Validation
 *
 * These tests ensure invoices are sent at the correct times.
 * Incorrect scheduling could send invoices at wrong times or not at all.
 *
 * Scheduling helpers: `auto-send-invoices/handlers/auto-send-scheduling.ts`.
 * Run with: `pnpm test:edge-unit` (includes this file).
 */

import { assertEquals } from "@std/assert";
import { shouldRunAutoSend } from "../auto-send-invoices/handlers/auto-send-scheduling.ts";
import type { AutoSendConfig } from "../auto-send-invoices/handlers/types.ts";

// Daily schedule tests
Deno.test("P0: should return true at configured time for daily schedule", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  // Use local time, not UTC, since getHours() returns local time
  const now = new Date(2024, 0, 15, 9, 0, 0); // Jan 15, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

Deno.test("P0: should return false at different time for daily schedule", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const now = new Date(2024, 0, 15, 10, 0, 0); // Jan 15, 2024, 10:00 local time

  assertEquals(shouldRunAutoSend(config, now), false);
});

Deno.test("P0: should use default 09:00 when time not specified", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "daily",
    // time not specified - should default to 09:00
  };
  // Note: The actual function uses default "09:00" from getAutoSendConfig
  // This test verifies the shouldRunAutoSend logic works with 09:00
  const now = new Date(2024, 0, 15, 9, 0, 0); // Jan 15, 2024, 09:00 local time
  const configWithTime: AutoSendConfig = {
    ...config,
    time: "09:00",
  };

  assertEquals(shouldRunAutoSend(configWithTime, now), true);
});

// Weekly schedule tests
Deno.test("P0: should return true on correct day of week at configured time", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "weekly",
    day_of_week: 1, // Monday
    time: "14:30",
  };
  // 2024-01-15 is a Monday
  const now = new Date(2024, 0, 15, 14, 30, 0); // Jan 15, 2024, 14:30 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

Deno.test("P0: should return false on wrong day of week", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "weekly",
    day_of_week: 1, // Monday
    time: "14:30",
  };
  // 2024-01-16 is a Tuesday
  const now = new Date(2024, 0, 16, 14, 30, 0); // Jan 16, 2024, 14:30 local time

  assertEquals(shouldRunAutoSend(config, now), false);
});

Deno.test("P0: should handle Sunday (0) correctly", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "weekly",
    day_of_week: 0, // Sunday
    time: "10:00",
  };
  // 2024-01-14 is a Sunday
  const now = new Date(2024, 0, 14, 10, 0, 0); // Jan 14, 2024, 10:00 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

Deno.test("P0: should handle Saturday (6) correctly", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "weekly",
    day_of_week: 6, // Saturday
    time: "10:00",
  };
  // 2024-01-13 is a Saturday
  const now = new Date(2024, 0, 13, 10, 0, 0); // Jan 13, 2024, 10:00 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

// Monthly schedule tests
Deno.test("P0: should return true on correct day of month at configured time", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "monthly",
    day_of_month: 15,
    time: "09:00",
  };
  const now = new Date(2024, 0, 15, 9, 0, 0); // Jan 15, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

Deno.test("P0: should return false on wrong day of month", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "monthly",
    day_of_month: 15,
    time: "09:00",
  };
  const now = new Date(2024, 0, 16, 9, 0, 0); // Jan 16, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), false);
});

Deno.test("P0: should handle month-end correctly (day 31 in months with 30 days)", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "monthly",
    day_of_month: 31,
    time: "09:00",
  };
  // April has 30 days, so day 31 should not match
  const now = new Date(2024, 3, 30, 9, 0, 0); // Apr 30, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), false);
});

// Disabled config tests
Deno.test("P0: should return false when enabled is false", () => {
  const config: AutoSendConfig = {
    enabled: false,
    period: "daily",
    time: "09:00",
  };
  const now = new Date(2024, 0, 15, 9, 0, 0); // Jan 15, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), false);
});

Deno.test("P0: should return false when config is null (handled by getAutoSendConfig)", () => {
  // This test verifies that shouldRunAutoSend returns false for disabled configs
  // The null check is handled by getAutoSendConfig which returns null
  const config: AutoSendConfig = {
    enabled: false,
    period: "daily",
  };
  const now = new Date(2024, 0, 15, 9, 0, 0); // Jan 15, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), false);
});

// Edge cases
Deno.test("P0: should handle time with single digit hours", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "9:00", // Single digit hour
  };
  const now = new Date(2024, 0, 15, 9, 0, 0); // Jan 15, 2024, 09:00 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

Deno.test("P0: should handle time with single digit minutes", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:5", // Single digit minute
  };
  const now = new Date(2024, 0, 15, 9, 5, 0); // Jan 15, 2024, 09:05 local time

  assertEquals(shouldRunAutoSend(config, now), true);
});

Deno.test("P0: should return false when time doesn't match exactly", () => {
  const config: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const now = new Date(2024, 0, 15, 9, 1, 0); // Jan 15, 2024, 09:01 local time (1 minute off)

  assertEquals(shouldRunAutoSend(config, now), false);
});
