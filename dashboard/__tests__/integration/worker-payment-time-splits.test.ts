/**
 * Integration tests for time-based worker payment splits with additive bonuses
 *
 * These tests verify the new payment calculation model:
 * 1. Time-based distribution of base worker payment
 * 2. Multiplier modifiers (applied to time share)
 * 3. Per-unit bonuses (additive, not deducted)
 * 4. Flat bonuses (additive, not deducted)
 * 5. Team percentage bonuses (percentage of other workers' time-shares)
 *
 * Key principle: Bonuses are ADDITIVE - they increase total payout,
 * not redistribute the existing pool.
 */

import type { CalculateWorkerPaymentsResponse } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Time-Based Worker Payment Splits with Additive Bonuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario 1: Single Worker, No Rate Card", () => {
    it("should give full base payment to single worker", async () => {
      // Given: Job with 1 worker, 8 hours worked, $500 base payment
      // When: Calculate worker payment
      // Then: Worker receives $500 (full base payment)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 500,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 500,
              total_adjustments: 0,
              total_worker_payment: 500,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Alice Smith",
                  hours_worked: 8,
                  time_share: 500,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 500,
                  allocation_type: "single_worker",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      expect(result.calculation.total_worker_payment).toBe(500);
      const split = result.calculation.job_calculations[0].worker_splits?.[0];
      expect(split?.final_payment).toBe(500);
      expect(split?.allocation_type).toBe("single_worker");
    });
  });

  describe("Scenario 2: Multiple Workers, Equal Hours, No Rate Cards", () => {
    it("should split equally when all workers have same hours", async () => {
      // Given: Job with 3 workers, each 8 hours, $600 base payment
      // When: Calculate worker payment
      // Then: Each worker receives $200 (equal split)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 600,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 600,
              total_adjustments: 0,
              total_worker_payment: 600,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Alice",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Bob",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-3",
                  worker_name: "Charlie",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;
      expect(splits).toHaveLength(3);
      splits?.forEach((split) => {
        expect(split.time_share).toBe(200);
        expect(split.final_payment).toBe(200);
      });
    });
  });

  describe("Scenario 3: Multiple Workers, Unequal Hours, No Rate Cards", () => {
    it("should split proportionally by hours worked", async () => {
      // Given: Job with 3 workers (8h, 6h, 2h), $480 base payment
      // When: Calculate worker payment
      // Then: Workers receive proportional shares ($240, $180, $60)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 480,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 480,
              total_adjustments: 0,
              total_worker_payment: 480,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Alice",
                  hours_worked: 8, // 8/16 = 50%
                  time_share: 240,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 240,
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Bob",
                  hours_worked: 6, // 6/16 = 37.5%
                  time_share: 180,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 180,
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-3",
                  worker_name: "Charlie",
                  hours_worked: 2, // 2/16 = 12.5%
                  time_share: 60,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 60,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;
      expect(splits?.[0].final_payment).toBe(240); // Alice: 8h
      expect(splits?.[1].final_payment).toBe(180); // Bob: 6h
      expect(splits?.[2].final_payment).toBe(60); // Charlie: 2h
    });
  });

  describe("Scenario 4: Supervisor with Per-Unit Bonus (Additive)", () => {
    it("should add per-unit bonus ON TOP of time share", async () => {
      // Given:
      //   - Job: 100 cars cleaned, $500 base payment (from pricing rules)
      //   - Workers: Alice (Supervisor, 8h, $0.50/car bonus), Bob (8h)
      // When: Calculate worker payment
      // Then:
      //   - Alice: $250 (time share) + $50 (bonus) = $300
      //   - Bob: $250 (time share)
      //   - Total: $550 (base + bonus)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 550, // $500 base + $50 bonus
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [
                {
                  field_config_id: "cars-field",
                  field_name: "cars_cleaned",
                  field_label: "Cars Cleaned",
                  quantity: 100,
                  unit_price: 5,
                  total: 500,
                },
              ],
              applied_rules: [],
              subtotal: 500,
              total_adjustments: 0,
              total_worker_payment: 550, // Includes bonus
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Alice (Supervisor)",
                  hours_worked: 8,
                  time_share: 250,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 50, // 100 cars × $0.50
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 300,
                  rate_card_id: "rate-card-1",
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Bob",
                  hours_worked: 8,
                  time_share: 250,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 250,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;

      // Alice gets time share + per-unit bonus
      expect(splits?.[0].time_share).toBe(250);
      expect(splits?.[0].per_unit_bonus).toBe(50);
      expect(splits?.[0].final_payment).toBe(300);

      // Bob gets only time share (no bonus)
      expect(splits?.[1].time_share).toBe(250);
      expect(splits?.[1].per_unit_bonus).toBe(0);
      expect(splits?.[1].final_payment).toBe(250);

      // Total is base + bonus
      expect(result.calculation.total_worker_payment).toBe(550);
    });
  });

  describe("Scenario 5: Worker with Multiplier", () => {
    it("should apply multiplier to time share", async () => {
      // Given:
      //   - Job: $600 base payment
      //   - Workers: Senior (8h, 1.2x multiplier), Junior (8h)
      // When: Calculate worker payment
      // Then:
      //   - Senior: base time share $300 × 1.2 = $360
      //   - Junior: $240 (gets reduced share due to multiplier)
      //   - Total: $600 (multiplier redistributes, doesn't add)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 600, // Same as base (multiplier redistributes)
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 600,
              total_adjustments: 0,
              total_worker_payment: 600,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Senior Worker",
                  hours_worked: 8,
                  time_share: 360, // After multiplier
                  multiplier_adjustment: 60, // 300 × 0.2
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 360,
                  rate_card_id: "rate-card-1",
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Junior Worker",
                  hours_worked: 8,
                  time_share: 240, // Remaining after multiplier redistribution
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 240,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;

      // Senior gets 1.2x multiplier on time share
      expect(splits?.[0].time_share).toBe(360);
      expect(splits?.[0].multiplier_adjustment).toBe(60);
      expect(splits?.[0].final_payment).toBe(360);

      // Junior gets remaining
      expect(splits?.[1].time_share).toBe(240);
      expect(splits?.[1].final_payment).toBe(240);

      // Total unchanged (multiplier redistributes, doesn't add)
      expect(result.calculation.total_worker_payment).toBe(600);
    });
  });

  describe("Scenario 6: Worker with Flat Bonus (Additive)", () => {
    it("should add flat bonus ON TOP of time share", async () => {
      // Given:
      //   - Job: $400 base payment
      //   - Workers: Lead (8h, $50 flat bonus), Helper (8h)
      // When: Calculate worker payment
      // Then:
      //   - Lead: $200 (time share) + $50 (bonus) = $250
      //   - Helper: $200 (time share)
      //   - Total: $450 (base + bonus)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 450,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 400,
              total_adjustments: 0,
              total_worker_payment: 450,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Lead",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 50,
                  team_percentage_bonus: 0,
                  final_payment: 250,
                  rate_card_id: "rate-card-1",
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Helper",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;

      // Lead gets time share + flat bonus
      expect(splits?.[0].flat_bonus).toBe(50);
      expect(splits?.[0].final_payment).toBe(250);

      // Helper gets only time share
      expect(splits?.[1].flat_bonus).toBe(0);
      expect(splits?.[1].final_payment).toBe(200);

      // Total includes additive bonus
      expect(result.calculation.total_worker_payment).toBe(450);
    });
  });

  describe("Scenario 7: No Time Tracking Data", () => {
    it("should use weights-only split when no hours tracked (equal when all weights 1.0)", async () => {
      // Given: Job with 3 workers, no start_time/end_time, $600 base
      // When: Calculate worker payment
      // Then: Each worker receives $200 (weights_only; same as equal when weights default to 1.0)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 600,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 600,
              total_adjustments: 0,
              total_worker_payment: 600,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Alice",
                  hours_worked: 0, // No time tracking
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "weights_only",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Bob",
                  hours_worked: 0,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "weights_only",
                },
                {
                  worker_id: "worker-3",
                  worker_name: "Charlie",
                  hours_worked: 0,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "weights_only",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;

      splits?.forEach((split) => {
        expect(split.hours_worked).toBe(0);
        expect(split.allocation_type).toBe("weights_only");
        expect(split.final_payment).toBe(200);
      });
    });
  });

  describe("Scenario 8: Combined Modifiers (Multiplier + Per-Unit Bonus)", () => {
    it("should apply multiplier to time share then add per-unit bonus", async () => {
      // Given:
      //   - Job: 100 cars, $500 base payment
      //   - Workers:
      //     - Supervisor: 8h, multiplier 1.2x, per-unit $0.50/car
      //     - Worker: 8h
      // When: Calculate worker payment
      // Then:
      //   - Supervisor: $300 (time share with multiplier) + $50 (bonus) = $350
      //   - Worker: $200 (remaining time share)
      //   - Total: $550

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 550,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [
                {
                  field_config_id: "cars-field",
                  field_name: "cars_cleaned",
                  field_label: "Cars Cleaned",
                  quantity: 100,
                  unit_price: 5,
                  total: 500,
                },
              ],
              applied_rules: [],
              subtotal: 500,
              total_adjustments: 0,
              total_worker_payment: 550,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Supervisor",
                  hours_worked: 8,
                  time_share: 300, // After multiplier
                  multiplier_adjustment: 50, // From multiplier
                  per_unit_bonus: 50, // 100 × $0.50
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 350,
                  rate_card_id: "rate-card-1",
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Worker",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 200,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;

      // Supervisor: multiplier + per-unit bonus
      expect(splits?.[0].time_share).toBe(300);
      expect(splits?.[0].multiplier_adjustment).toBe(50);
      expect(splits?.[0].per_unit_bonus).toBe(50);
      expect(splits?.[0].final_payment).toBe(350);

      // Worker: time share only
      expect(splits?.[1].time_share).toBe(200);
      expect(splits?.[1].final_payment).toBe(200);

      expect(result.calculation.total_worker_payment).toBe(550);
    });
  });

  describe("Scenario 9: Per-Unit Bonus with Multiple Fields", () => {
    it("should calculate bonus from multiple field values", async () => {
      // Given:
      //   - Worker has per_unit rate card for fields: "cars_cleaned", "trucks_cleaned"
      //   - Job data: cars_cleaned=50, trucks_cleaned=20
      //   - Rate: $0.50/unit
      // When: Calculate worker payment
      // Then: Bonus = (50 + 20) × $0.50 = $35

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 235, // $200 base + $35 bonus
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 200,
              total_adjustments: 0,
              total_worker_payment: 235,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Worker",
                  hours_worked: 8,
                  time_share: 200,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 35, // (50 + 20) × $0.50
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 235,
                  rate_card_id: "rate-card-1",
                  allocation_type: "single_worker",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const split = result.calculation.job_calculations[0].worker_splits?.[0];
      expect(split?.per_unit_bonus).toBe(35);
      expect(split?.final_payment).toBe(235);
    });
  });

  describe("Scenario 10: Worker Splits Stored in Payment", () => {
    it("should include worker_split details in calculation_details", async () => {
      // This tests that the save-worker-payment function
      // correctly stores the worker split breakdown

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 500,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 500,
              total_adjustments: 0,
              total_worker_payment: 500,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Alice",
                  hours_worked: 8,
                  time_share: 250,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 50,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 300,
                  rate_card_id: "rate-card-1",
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Bob",
                  hours_worked: 8,
                  time_share: 250,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 250,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      // Verify the worker_splits are present for saving
      const workerSplits = result.calculation.job_calculations[0].worker_splits;
      expect(workerSplits).toBeDefined();
      expect(workerSplits).toHaveLength(2);

      // Verify all breakdown fields are present
      const aliceSplit = workerSplits?.find((s) => s.worker_id === "worker-1");
      expect(aliceSplit).toMatchObject({
        hours_worked: 8,
        time_share: 250,
        multiplier_adjustment: 0,
        per_unit_bonus: 50,
        flat_bonus: 0,
        team_percentage_bonus: 0,
        final_payment: 300,
        allocation_type: "time_based",
        rate_card_id: "rate-card-1",
      });
    });
  });

  describe("Scenario 11: Team Percentage Bonus (Supervisor)", () => {
    it("should calculate team percentage bonus from other workers' time shares", async () => {
      // Given:
      //   - Job: $500 base payment
      //   - Workers:
      //     - Team Lead: 8h, team_percentage 10% (of other workers' earnings)
      //     - Worker B: 8h
      //     - Worker C: 6h (arrived late)
      // When: Calculate worker payment
      // Then:
      //   - Team Lead: $181.82 (time share) + $31.82 (10% of $318.18) = $213.64
      //   - Worker B: $181.82 (time share)
      //   - Worker C: $136.36 (time share)
      //   - Total: $531.82 (base + team percentage bonus)

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 531.82, // $500 base + $31.82 bonus
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 500,
              total_adjustments: 0,
              total_worker_payment: 531.82,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Team Lead",
                  hours_worked: 8, // 8/22 = 36.4%
                  time_share: 181.82,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 31.82, // 10% of ($181.82 + $136.36)
                  final_payment: 213.64,
                  rate_card_id: "rate-card-1",
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-2",
                  worker_name: "Worker B",
                  hours_worked: 8, // 8/22 = 36.4%
                  time_share: 181.82,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 181.82,
                  allocation_type: "time_based",
                },
                {
                  worker_id: "worker-3",
                  worker_name: "Worker C",
                  hours_worked: 6, // 6/22 = 27.3%
                  time_share: 136.36,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0,
                  final_payment: 136.36,
                  allocation_type: "time_based",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const splits = result.calculation.job_calculations[0].worker_splits;

      // Team Lead gets time share + team percentage bonus
      expect(splits?.[0].time_share).toBe(181.82);
      expect(splits?.[0].team_percentage_bonus).toBe(31.82);
      expect(splits?.[0].final_payment).toBe(213.64);

      // Workers B and C get only their time shares
      expect(splits?.[1].team_percentage_bonus).toBe(0);
      expect(splits?.[1].final_payment).toBe(181.82);
      expect(splits?.[2].team_percentage_bonus).toBe(0);
      expect(splits?.[2].final_payment).toBe(136.36);

      // Total includes team percentage bonus
      expect(result.calculation.total_worker_payment).toBe(531.82);
    });
  });

  describe("Scenario 12: Solo Worker with Team Percentage", () => {
    it("should give zero team bonus when worker is alone", async () => {
      // Given: Job with 1 worker who has team_percentage modifier
      // When: Calculate worker payment
      // Then: Worker receives full base payment, team bonus is $0

      const mockResponse: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 500,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 500,
              total_adjustments: 0,
              total_worker_payment: 500,
              worker_splits: [
                {
                  worker_id: "worker-1",
                  worker_name: "Solo Team Lead",
                  hours_worked: 8,
                  time_share: 500,
                  multiplier_adjustment: 0,
                  per_unit_bonus: 0,
                  flat_bonus: 0,
                  team_percentage_bonus: 0, // No other workers
                  final_payment: 500,
                  rate_card_id: "rate-card-1",
                  allocation_type: "single_worker",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await WorkerPaymentService.calculatePayments({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      const split = result.calculation.job_calculations[0].worker_splits?.[0];
      expect(split?.team_percentage_bonus).toBe(0);
      expect(split?.final_payment).toBe(500);
    });
  });
});
