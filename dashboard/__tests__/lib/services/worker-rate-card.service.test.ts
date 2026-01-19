/**
 * Worker Rate Card Service Tests
 *
 * Tests for the WorkerRateCardService which handles CRUD operations
 * for worker payment rate cards with modifier types (per_unit, flat, multiplier).
 * Uses edge function (manage-worker-rate-card) for all operations.
 */

import {
    type CreateRateCardRequest,
    type WorkerRateCard,
    WorkerRateCardService,
} from "@/lib/services/worker-rate-card.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Helper to create mock rate card data
const createMockRateCard = (
    overrides?: Partial<WorkerRateCard>,
): WorkerRateCard => ({
    id: "rate-card-1",
    organization_id: "org-1",
    worker_id: "worker-1",
    modifier_type: "flat",
    modifier_value: 25,
    currency: "AUD",
    effective_from: "2024-01-01",
    effective_to: null,
    role_title: "Supervisor",
    is_active: true,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    field_config_ids: [],
    ...overrides,
});

describe("WorkerRateCardService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("list", () => {
        it("should return all rate cards for an organization", async () => {
            const mockRateCards = [
                createMockRateCard({ id: "rate-1", modifier_type: "flat" }),
                createMockRateCard({
                    id: "rate-2",
                    modifier_type: "per_unit",
                    field_config_ids: ["field-1"],
                }),
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: mockRateCards },
                error: null,
            });

            const result = await WorkerRateCardService.list("org-1");

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "manage-worker-rate-card",
                {
                    body: {
                        action: "list",
                        organization_id: "org-1",
                    },
                },
            );
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe("rate-1");
            expect(result[1].field_config_ids).toEqual(["field-1"]);
        });

        it("should return empty array when no rate cards exist", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [] },
                error: null,
            });

            const result = await WorkerRateCardService.list("org-1");

            expect(result).toEqual([]);
        });

        it("should throw error on edge function failure", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Edge function error" },
            });

            await expect(WorkerRateCardService.list("org-1")).rejects.toThrow(
                "Edge function error",
            );
        });

        it("should throw error when response is not successful", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false, error: "Database error" },
                error: null,
            });

            await expect(WorkerRateCardService.list("org-1")).rejects.toThrow(
                "Database error",
            );
        });
    });

    describe("getForWorker", () => {
        it("should return rate cards for a specific worker", async () => {
            const mockRateCards = [
                createMockRateCard({ id: "rate-1", worker_id: "worker-1" }),
                createMockRateCard({ id: "rate-2", worker_id: "worker-2" }),
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: mockRateCards },
                error: null,
            });

            const result = await WorkerRateCardService.getForWorker(
                "org-1",
                "worker-1",
            );

            expect(result).toHaveLength(1);
            expect(result[0].worker_id).toBe("worker-1");
        });

        it("should return empty array when worker has no rate cards", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [] },
                error: null,
            });

            const result = await WorkerRateCardService.getForWorker(
                "org-1",
                "worker-1",
            );

            expect(result).toEqual([]);
        });
    });

    describe("getCurrentRate", () => {
        it("should return active rate card within effective date range", async () => {
            const mockRateCard = createMockRateCard({
                effective_from: "2024-01-01",
                effective_to: null,
                is_active: true,
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [mockRateCard] },
                error: null,
            });

            const result = await WorkerRateCardService.getCurrentRate(
                "org-1",
                "worker-1",
            );

            expect(result).not.toBeNull();
            expect(result?.id).toBe("rate-card-1");
        });

        it("should filter by modifier_type if provided", async () => {
            const flatCard = createMockRateCard({
                id: "rate-1",
                modifier_type: "flat",
            });
            const multiplierCard = createMockRateCard({
                id: "rate-2",
                modifier_type: "multiplier",
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [flatCard, multiplierCard] },
                error: null,
            });

            const result = await WorkerRateCardService.getCurrentRate(
                "org-1",
                "worker-1",
                "flat",
            );

            expect(result?.modifier_type).toBe("flat");
        });

        it("should return null when no active rate card exists", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [] },
                error: null,
            });

            const result = await WorkerRateCardService.getCurrentRate(
                "org-1",
                "worker-1",
            );

            expect(result).toBeNull();
        });

        it("should exclude inactive rate cards", async () => {
            const mockRateCard = createMockRateCard({
                is_active: false,
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [mockRateCard] },
                error: null,
            });

            const result = await WorkerRateCardService.getCurrentRate(
                "org-1",
                "worker-1",
            );

            expect(result).toBeNull();
        });
    });

    describe("create", () => {
        it("should create rate card with all required fields", async () => {
            const mockCreatedCard = createMockRateCard();

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_card: mockCreatedCard },
                error: null,
            });

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "flat",
                modifier_value: 25,
                role_title: "Supervisor",
            };

            const result = await WorkerRateCardService.create(request);

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "manage-worker-rate-card",
                {
                    body: expect.objectContaining({
                        action: "create",
                        organization_id: "org-1",
                        worker_id: "worker-1",
                        modifier_type: "flat",
                        modifier_value: 25,
                        role_title: "Supervisor",
                    }),
                },
            );
            expect(result.id).toBe("rate-card-1");
        });

        it("should create rate card with field_config_ids for per_unit type", async () => {
            const mockCreatedCard = createMockRateCard({
                modifier_type: "per_unit",
                field_config_ids: ["field-1", "field-2"],
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_card: mockCreatedCard },
                error: null,
            });

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "per_unit",
                modifier_value: 0.5,
                field_config_ids: ["field-1", "field-2"],
            };

            await WorkerRateCardService.create(request);

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "manage-worker-rate-card",
                {
                    body: expect.objectContaining({
                        action: "create",
                        modifier_type: "per_unit",
                        field_config_ids: ["field-1", "field-2"],
                    }),
                },
            );
        });

        it("should throw error on failure", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Create failed" },
            });

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "flat",
                modifier_value: 25,
            };

            await expect(WorkerRateCardService.create(request)).rejects.toThrow(
                "Create failed",
            );
        });
    });

    describe("update", () => {
        it("should update rate card fields correctly", async () => {
            const mockUpdatedCard = createMockRateCard({
                modifier_value: 30,
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_card: mockUpdatedCard },
                error: null,
            });

            const result = await WorkerRateCardService.update("org-1", {
                id: "rate-card-1",
                modifier_value: 30,
                role_title: "Senior Supervisor",
            });

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "manage-worker-rate-card",
                {
                    body: expect.objectContaining({
                        action: "update",
                        organization_id: "org-1",
                        id: "rate-card-1",
                        modifier_value: 30,
                        role_title: "Senior Supervisor",
                    }),
                },
            );
            expect(result.modifier_value).toBe(30);
        });

        it("should throw error on failure", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Update failed" },
            });

            await expect(
                WorkerRateCardService.update("org-1", {
                    id: "rate-card-1",
                    modifier_value: 30,
                }),
            ).rejects.toThrow("Update failed");
        });
    });

    describe("deactivate", () => {
        it("should deactivate rate card", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await WorkerRateCardService.deactivate("org-1", "rate-card-1");

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "manage-worker-rate-card",
                {
                    body: {
                        action: "deactivate",
                        organization_id: "org-1",
                        id: "rate-card-1",
                    },
                },
            );
        });

        it("should throw error on failure", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Deactivate failed" },
            });

            await expect(
                WorkerRateCardService.deactivate("org-1", "rate-card-1"),
            ).rejects.toThrow("Deactivate failed");
        });
    });

    describe("delete", () => {
        it("should delete rate card", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await WorkerRateCardService.delete("org-1", "rate-card-1");

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "manage-worker-rate-card",
                {
                    body: {
                        action: "delete",
                        organization_id: "org-1",
                        id: "rate-card-1",
                    },
                },
            );
        });

        it("should throw error on failure", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Delete failed" },
            });

            await expect(
                WorkerRateCardService.delete("org-1", "rate-card-1"),
            ).rejects.toThrow("Delete failed");
        });
    });

    describe("modifier type validation", () => {
        it("should handle per_unit modifier type correctly", async () => {
            const mockRateCard = createMockRateCard({
                modifier_type: "per_unit",
                modifier_value: 0.5,
                field_config_ids: ["field-1"],
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [mockRateCard] },
                error: null,
            });

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].modifier_type).toBe("per_unit");
            expect(result[0].modifier_value).toBe(0.5);
            expect(result[0].field_config_ids).toEqual(["field-1"]);
        });

        it("should handle flat modifier type correctly", async () => {
            const mockRateCard = createMockRateCard({
                modifier_type: "flat",
                modifier_value: 25,
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [mockRateCard] },
                error: null,
            });

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].modifier_type).toBe("flat");
            expect(result[0].modifier_value).toBe(25);
        });

        it("should handle multiplier modifier type correctly", async () => {
            const mockRateCard = createMockRateCard({
                modifier_type: "multiplier",
                modifier_value: 1.2,
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, rate_cards: [mockRateCard] },
                error: null,
            });

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].modifier_type).toBe("multiplier");
            expect(result[0].modifier_value).toBe(1.2);
        });
    });
});
