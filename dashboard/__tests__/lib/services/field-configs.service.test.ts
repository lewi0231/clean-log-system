import { FieldConfigsService } from "@/lib/services/field-configs.service";
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
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe("FieldConfigsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("list", () => {
        it("should list field configs successfully", async () => {
            const mockFieldConfigs = [
                {
                    id: "field-1",
                    name: "service_type",
                    label: "Service Type",
                    field_type: "select",
                    options: ["Cleaning", "Maintenance"],
                    active: true,
                    order: 0,
                },
                {
                    id: "field-2",
                    name: "notes",
                    label: "Notes",
                    field_type: "textarea",
                    options: null,
                    active: true,
                    order: 1,
                },
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    field_configs: mockFieldConfigs,
                },
                error: null,
            });

            const result = await FieldConfigsService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual(mockFieldConfigs);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-field-configs",
                {
                    body: {
                        organization_id: "org-1",
                    },
                },
            );
        });

        it("should return empty array when no field configs exist", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    field_configs: [],
                },
                error: null,
            });

            const result = await FieldConfigsService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual([]);
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                FieldConfigsService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when field_configs is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {},
                error: null,
            });

            await expect(
                FieldConfigsService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("Failed to fetch field configs");
        });
    });
});
