/**
 * Worker Rate Card Service Tests
 *
 * Tests for the WorkerRateCardService which handles CRUD operations
 * for worker payment rate cards with modifier types (per_unit, flat, multiplier).
 */

import {
    type CreateRateCardRequest,
    type UpdateRateCardRequest,
    type WorkerRateCard,
    WorkerRateCardService,
} from "@/lib/services/worker-rate-card.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
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
    ...overrides,
});

// Helper to create mock chain for supabase queries
const createMockChain = (
    data: unknown = null,
    error: { message: string } | null = null,
) => {
    const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error }),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
        then: vi.fn().mockResolvedValue({ data, error }),
    };
    // Make the chain thenable for async queries
    Object.assign(chain, {
        then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
            Promise.resolve({ data, error }).then(resolve),
    });
    return chain;
};

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
                    worker_rate_card_field: [{ field_config_id: "field-1" }],
                }),
            ];

            const chain = createMockChain(mockRateCards);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.list("org-1");

            expect(supabase.from).toHaveBeenCalledWith("worker_rate_card");
            expect(chain.select).toHaveBeenCalled();
            expect(chain.eq).toHaveBeenCalledWith("organization_id", "org-1");
            expect(chain.order).toHaveBeenCalledWith("created_at", {
                ascending: false,
            });
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe("rate-1");
            expect(result[1].field_config_ids).toEqual(["field-1"]);
        });

        it("should return empty array when no rate cards exist", async () => {
            const chain = createMockChain([]);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.list("org-1");

            expect(result).toEqual([]);
        });

        it("should throw error on database failure", async () => {
            const chain = createMockChain(null, { message: "Database error" });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await expect(WorkerRateCardService.list("org-1")).rejects.toThrow(
                "Database error",
            );
        });

        it("should transform field mappings to field_config_ids array", async () => {
            const mockRateCards = [
                createMockRateCard({
                    id: "rate-1",
                    modifier_type: "per_unit",
                    worker_rate_card_field: [
                        { field_config_id: "field-1" },
                        { field_config_id: "field-2" },
                    ],
                }),
            ];

            const chain = createMockChain(mockRateCards);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].field_config_ids).toEqual(["field-1", "field-2"]);
        });

        it("should handle null field mappings gracefully", async () => {
            const mockRateCards = [
                createMockRateCard({
                    id: "rate-1",
                    modifier_type: "flat",
                    worker_rate_card_field: null,
                }),
            ];

            const chain = createMockChain(mockRateCards);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].field_config_ids).toEqual([]);
        });
    });

    describe("getForWorker", () => {
        it("should return rate cards for a specific worker", async () => {
            const mockRateCards = [
                createMockRateCard({ id: "rate-1", worker_id: "worker-1" }),
            ];

            const chain = createMockChain(mockRateCards);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.getForWorker(
                "org-1",
                "worker-1",
            );

            expect(chain.eq).toHaveBeenCalledWith("organization_id", "org-1");
            expect(chain.eq).toHaveBeenCalledWith("worker_id", "worker-1");
            expect(chain.order).toHaveBeenCalledWith("effective_from", {
                ascending: false,
            });
            expect(result).toHaveLength(1);
            expect(result[0].worker_id).toBe("worker-1");
        });

        it("should return empty array when worker has no rate cards", async () => {
            const chain = createMockChain([]);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

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
            });

            const chain = createMockChain(mockRateCard);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.getCurrentRate(
                "org-1",
                "worker-1",
            );

            expect(chain.eq).toHaveBeenCalledWith("is_active", true);
            expect(chain.limit).toHaveBeenCalledWith(1);
            expect(result).not.toBeNull();
            expect(result?.id).toBe("rate-card-1");
        });

        it("should filter by modifier_type if provided", async () => {
            const mockRateCard = createMockRateCard({ modifier_type: "flat" });

            const chain = createMockChain(mockRateCard);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await WorkerRateCardService.getCurrentRate(
                "org-1",
                "worker-1",
                "flat",
            );

            expect(chain.eq).toHaveBeenCalledWith("modifier_type", "flat");
        });

        it("should return null when no active rate card exists", async () => {
            const chain = createMockChain(null);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

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
            const insertChain = createMockChain(mockCreatedCard);
            vi.mocked(supabase.from).mockReturnValue(insertChain as ReturnType<typeof supabase.from>);

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "flat",
                modifier_value: 25,
                role_title: "Supervisor",
            };

            const result = await WorkerRateCardService.create(request);

            expect(supabase.from).toHaveBeenCalledWith("worker_rate_card");
            expect(insertChain.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    organization_id: "org-1",
                    worker_id: "worker-1",
                    modifier_type: "flat",
                    modifier_value: 25,
                    role_title: "Supervisor",
                    is_active: true,
                }),
            );
            expect(result.id).toBe("rate-card-1");
        });

        it("should create field mappings for per_unit type", async () => {
            const mockCreatedCard = createMockRateCard({
                modifier_type: "per_unit",
            });

            // First call for insert, second for field mappings
            const insertChain = createMockChain(mockCreatedCard);
            const fieldMappingChain = createMockChain([]);

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation((table: string) => {
                callCount++;
                if (table === "worker_rate_card") {
                    return insertChain as ReturnType<typeof supabase.from>;
                }
                return fieldMappingChain as ReturnType<typeof supabase.from>;
            });

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "per_unit",
                modifier_value: 0.5,
                field_config_ids: ["field-1", "field-2"],
            };

            const result = await WorkerRateCardService.create(request);

            expect(result.field_config_ids).toEqual(["field-1", "field-2"]);
        });

        it("should set default currency to AUD if not provided", async () => {
            const mockCreatedCard = createMockRateCard({ currency: "AUD" });
            const chain = createMockChain(mockCreatedCard);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "flat",
                modifier_value: 25,
            };

            await WorkerRateCardService.create(request);

            expect(chain.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    currency: "AUD",
                }),
            );
        });

        it("should set default effective_from to today if not provided", async () => {
            const mockCreatedCard = createMockRateCard();
            const chain = createMockChain(mockCreatedCard);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "flat",
                modifier_value: 25,
            };

            await WorkerRateCardService.create(request);

            expect(chain.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    effective_from: expect.any(String),
                }),
            );
        });

        it("should throw error on invalid data", async () => {
            const chain = createMockChain(null, { message: "Insert failed" });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const request: CreateRateCardRequest = {
                organization_id: "org-1",
                worker_id: "worker-1",
                modifier_type: "flat",
                modifier_value: 25,
            };

            await expect(WorkerRateCardService.create(request)).rejects.toThrow(
                "Insert failed",
            );
        });
    });

    describe("update", () => {
        it("should update rate card fields correctly", async () => {
            const mockUpdatedCard = createMockRateCard({
                modifier_value: 30,
            });
            const chain = createMockChain(mockUpdatedCard);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const request: UpdateRateCardRequest = {
                id: "rate-card-1",
                modifier_value: 30,
                role_title: "Senior Supervisor",
            };

            const result = await WorkerRateCardService.update(request);

            expect(chain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    modifier_value: 30,
                    role_title: "Senior Supervisor",
                    updated_at: expect.any(String),
                }),
            );
            expect(chain.eq).toHaveBeenCalledWith("id", "rate-card-1");
            expect(result.modifier_value).toBe(30);
        });

        it("should update field mappings when field_config_ids provided", async () => {
            const mockUpdatedCard = createMockRateCard({
                modifier_type: "per_unit",
            });

            // Multiple calls: update, delete field mappings, insert field mappings
            const updateChain = createMockChain(mockUpdatedCard);
            const deleteChain = createMockChain([]);
            const insertChain = createMockChain([]);

            vi.mocked(supabase.from).mockImplementation((table: string) => {
                if (table === "worker_rate_card") {
                    return updateChain as ReturnType<typeof supabase.from>;
                }
                return deleteChain as ReturnType<typeof supabase.from>;
            });

            const request: UpdateRateCardRequest = {
                id: "rate-card-1",
                field_config_ids: ["field-1", "field-3"],
            };

            const result = await WorkerRateCardService.update(request);

            expect(result.field_config_ids).toEqual(["field-1", "field-3"]);
        });

        it("should remove all field mappings when empty array provided", async () => {
            const mockUpdatedCard = createMockRateCard();
            const chain = createMockChain(mockUpdatedCard);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const request: UpdateRateCardRequest = {
                id: "rate-card-1",
                field_config_ids: [],
            };

            const result = await WorkerRateCardService.update(request);

            expect(result.field_config_ids).toEqual([]);
        });
    });

    describe("deactivate", () => {
        it("should set is_active to false", async () => {
            const chain = createMockChain({ success: true });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await WorkerRateCardService.deactivate("rate-card-1");

            expect(chain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    is_active: false,
                }),
            );
            expect(chain.eq).toHaveBeenCalledWith("id", "rate-card-1");
        });

        it("should set effective_to to today", async () => {
            const chain = createMockChain({ success: true });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await WorkerRateCardService.deactivate("rate-card-1");

            expect(chain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    effective_to: expect.any(String),
                }),
            );
        });

        it("should throw error on failure", async () => {
            const chain = createMockChain(null, {
                message: "Deactivate failed",
            });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await expect(
                WorkerRateCardService.deactivate("rate-card-1"),
            ).rejects.toThrow("Deactivate failed");
        });
    });

    describe("delete", () => {
        it("should delete rate card from database", async () => {
            const chain = createMockChain({ success: true });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await WorkerRateCardService.delete("rate-card-1");

            expect(supabase.from).toHaveBeenCalledWith("worker_rate_card");
            expect(chain.delete).toHaveBeenCalled();
            expect(chain.eq).toHaveBeenCalledWith("id", "rate-card-1");
        });

        it("should throw error if rate card doesn't exist", async () => {
            const chain = createMockChain(null, { message: "Not found" });
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            await expect(
                WorkerRateCardService.delete("rate-card-1"),
            ).rejects.toThrow("Not found");
        });
    });

    describe("modifier type validation", () => {
        it("should handle per_unit modifier type correctly", async () => {
            const mockRateCard = createMockRateCard({
                modifier_type: "per_unit",
                modifier_value: 0.5,
                worker_rate_card_field: [{ field_config_id: "field-1" }],
            });

            const chain = createMockChain([mockRateCard]);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

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

            const chain = createMockChain([mockRateCard]);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].modifier_type).toBe("flat");
            expect(result[0].modifier_value).toBe(25);
        });

        it("should handle multiplier modifier type correctly", async () => {
            const mockRateCard = createMockRateCard({
                modifier_type: "multiplier",
                modifier_value: 1.2,
            });

            const chain = createMockChain([mockRateCard]);
            vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

            const result = await WorkerRateCardService.list("org-1");

            expect(result[0].modifier_type).toBe("multiplier");
            expect(result[0].modifier_value).toBe(1.2);
        });
    });
});
