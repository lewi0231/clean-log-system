import { OrganizationUsersService } from "@/lib/services/organization-users.service";
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

describe("OrganizationUsersService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("list", () => {
        it("should list organization users successfully", async () => {
            const mockResponse = {
                success: true,
                organization_users: [
                    {
                        id: "user-1",
                        email: "admin@example.com",
                        role: "admin",
                        organization_id: "org-1",
                    },
                    {
                        id: "user-2",
                        email: "user@example.com",
                        role: "viewer",
                        organization_id: "org-1",
                    },
                ],
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await OrganizationUsersService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual(mockResponse);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-organization-users",
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
                OrganizationUsersService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toEqual(mockError);
        });

        it("should throw error when success is false", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(
                OrganizationUsersService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("Failed to fetch organization users");
        });
    });

    describe("create", () => {
        it("should create organization user successfully", async () => {
            const mockUser = {
                id: "user-1",
                email: "newuser@example.com",
                role: "user",
                organization_id: "org-1",
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    organization_user: mockUser,
                },
                error: null,
            });

            const result = await OrganizationUsersService.create({
                organization_id: "org-1",
                email: "newuser@example.com",
                role: "viewer",
            });

            expect(result).toEqual(mockUser);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "create-organization-user",
                {
                    body: {
                        organization_id: "org-1",
                        email: "newuser@example.com",
                        role: "viewer",
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
                OrganizationUsersService.create({
                    organization_id: "org-1",
                    email: "newuser@example.com",
                    role: "viewer",
                }),
            ).rejects.toEqual(mockError);
        });

        it("should throw error when organization_user is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {},
                error: null,
            });

            await expect(
                OrganizationUsersService.create({
                    organization_id: "org-1",
                    email: "newuser@example.com",
                    role: "viewer",
                }),
            ).rejects.toThrow("Failed to create organization user");
        });
    });

    describe("update", () => {
        it("should update organization user successfully", async () => {
            const mockUser = {
                id: "user-1",
                email: "updated@example.com",
                role: "admin",
                organization_id: "org-1",
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    organization_user: mockUser,
                },
                error: null,
            });

            const result = await OrganizationUsersService.update({
                id: "user-1",
                role: "admin",
            });

            expect(result).toEqual(mockUser);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "update-organization-user",
                {
                    body: {
                        id: "user-1",
                        role: "admin",
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
                OrganizationUsersService.update({
                    id: "user-1",
                    role: "admin",
                }),
            ).rejects.toEqual(mockError);
        });

        it("should throw error when organization_user is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {},
                error: null,
            });

            await expect(
                OrganizationUsersService.update({
                    id: "user-1",
                    role: "admin",
                }),
            ).rejects.toThrow("Failed to update organization user");
        });
    });

    describe("delete", () => {
        it("should delete organization user successfully", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: null,
            });

            await OrganizationUsersService.delete({
                id: "user-1",
            });

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "delete-organization-user",
                {
                    body: {
                        id: "user-1",
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
                OrganizationUsersService.delete({
                    id: "user-1",
                }),
            ).rejects.toEqual(mockError);
        });
    });
});
