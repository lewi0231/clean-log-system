import { LocationHierarchyService } from "@/lib/services/location-hierarchy.service";
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

describe("LocationHierarchyService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("list", () => {
        it("should list location hierarchy nodes successfully", async () => {
            const mockNodes = [
                {
                    id: "node-1",
                    name: "Company A",
                    type: "company",
                    parent_id: null,
                    organization_id: "org-1",
                },
                {
                    id: "node-2",
                    name: "Region 1",
                    type: "region",
                    parent_id: "node-1",
                    organization_id: "org-1",
                },
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    nodes: mockNodes,
                },
                error: null,
            });

            const result = await LocationHierarchyService.list({
                organization_id: "org-1",
            });

            expect(result.nodes).toEqual(mockNodes);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-location-hierarchy",
                {
                    body: {
                        organization_id: "org-1",
                    },
                },
            );
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                LocationHierarchyService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when success is false", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(
                LocationHierarchyService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("Failed to list location hierarchy");
        });
    });

    describe("create", () => {
        it("should create location hierarchy node successfully", async () => {
            const mockNode = {
                id: "node-1",
                name: "New Company",
                type: "company",
                parent_id: null,
                organization_id: "org-1",
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    node: mockNode,
                },
                error: null,
            });

            const result = await LocationHierarchyService.create({
                organization_id: "org-1",
                name: "New Company",
                type: "company",
            });

            expect(result).toEqual(mockNode);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "create-location-hierarchy",
                {
                    body: {
                        organization_id: "org-1",
                        name: "New Company",
                        type: "company",
                    },
                },
            );
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                LocationHierarchyService.create({
                    organization_id: "org-1",
                    name: "New Company",
                    type: "company",
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when node is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await expect(
                LocationHierarchyService.create({
                    organization_id: "org-1",
                    name: "New Company",
                    type: "company",
                }),
            ).rejects.toThrow("Failed to create location hierarchy node");
        });
    });

    describe("update", () => {
        it("should update location hierarchy node successfully", async () => {
            const mockNode = {
                id: "node-1",
                name: "Updated Company",
                type: "company",
                parent_id: null,
                organization_id: "org-1",
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    node: mockNode,
                },
                error: null,
            });

            const result = await LocationHierarchyService.update({
                id: "node-1",
                name: "Updated Company",
            });

            expect(result).toEqual(mockNode);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "update-location-hierarchy",
                {
                    body: {
                        id: "node-1",
                        name: "Updated Company",
                    },
                },
            );
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                LocationHierarchyService.update({
                    id: "node-1",
                    name: "Updated Company",
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when node is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await expect(
                LocationHierarchyService.update({
                    id: "node-1",
                    name: "Updated Company",
                }),
            ).rejects.toThrow("Failed to update location hierarchy node");
        });
    });

    describe("delete", () => {
        it("should delete location hierarchy node successfully", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                },
                error: null,
            });

            await LocationHierarchyService.delete({
                id: "node-1",
            });

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "delete-location-hierarchy",
                {
                    body: {
                        id: "node-1",
                    },
                },
            );
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                LocationHierarchyService.delete({
                    id: "node-1",
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when success is false", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: false,
                    message: "Cannot delete node with children",
                },
                error: null,
            });

            await expect(
                LocationHierarchyService.delete({
                    id: "node-1",
                }),
            ).rejects.toThrow("Cannot delete node with children");
        });
    });
});
