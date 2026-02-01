import { OrganizationUsersService } from "@/lib/services/organization-users.service";
import { supabase } from "@/lib/supabase";
import type { OrganizationUser } from "@/lib/types";
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

// Helper function to create mock organization user
const createMockOrganizationUser = (overrides: Partial<OrganizationUser> = {}): OrganizationUser => ({
    id: "user-1",
    organization_id: "org-1",
    email: "test@example.com",
    role: "admin",
    first_name: "John",
    last_name: "Doe",
    phone: "+15551234567",
    status: "active",
    auth_user_id: "auth-user-1",
    invited_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
});

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
            ).rejects.toMatchObject(mockError);
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
            ).rejects.toMatchObject(mockError);
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
            ).rejects.toMatchObject(mockError);
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
            ).rejects.toMatchObject(mockError);
        });
    });

    describe("resendInvitation", () => {
        it("should resend invitation successfully", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, message: "Invitation resent" },
                error: null,
            });

            await OrganizationUsersService.resendInvitation({
                organization_user_id: "user-1",
                organization_id: "org-1",
            });

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "resend-admin-invitation",
                {
                    body: {
                        organization_user_id: "user-1",
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
                OrganizationUsersService.resendInvitation({
                    organization_user_id: "user-1",
                    organization_id: "org-1",
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when success is false", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false, message: "User not found" },
                error: null,
            });

            await expect(
                OrganizationUsersService.resendInvitation({
                    organization_user_id: "user-1",
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("User not found");
        });

        it("should throw generic error when no message provided", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(
                OrganizationUsersService.resendInvitation({
                    organization_user_id: "user-1",
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("Failed to resend invitation");
        });
    });

    describe("convertToWorker", () => {
        it("should convert user to worker successfully", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    worker: {
                        id: "worker-1",
                        name: "John Doe",
                        email: "john@example.com",
                        active: true,
                    },
                    message: "User can now use the mobile app",
                },
                error: null,
            });

            const result = await OrganizationUsersService.convertToWorker(
                "user-1",
                "org-1",
            );

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "convert-admin-to-worker",
                {
                    body: {
                        organization_user_id: "user-1",
                        organization_id: "org-1",
                    },
                },
            );
            expect(result.workerId).toBe("worker-1");
            expect(result.alreadyWorker).toBe(false);
        });

        it("should return alreadyWorker true when user is already a worker", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    worker_id: "worker-1",
                    already_worker: true,
                    message: "User already has a worker account",
                },
                error: null,
            });

            const result = await OrganizationUsersService.convertToWorker(
                "user-1",
                "org-1",
            );

            expect(result.alreadyWorker).toBe(true);
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                OrganizationUsersService.convertToWorker("user-1", "org-1"),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when success is false", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: false,
                    message: "User must activate their account first",
                },
                error: null,
            });

            await expect(
                OrganizationUsersService.convertToWorker("user-1", "org-1"),
            ).rejects.toThrow("User must activate their account first");
        });

        it("should throw generic error when no message provided", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(
                OrganizationUsersService.convertToWorker("user-1", "org-1"),
            ).rejects.toThrow("Failed to convert user to worker");
        });
    });

    describe("create with new fields", () => {
        it("should create organization user with first_name, last_name, phone", async () => {
            const mockUser = createMockOrganizationUser({
                status: "pending",
                auth_user_id: null,
                activated_at: null,
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    organization_user: mockUser,
                    invitation_sent: true,
                },
                error: null,
            });

            const result = await OrganizationUsersService.create({
                organization_id: "org-1",
                email: "newuser@example.com",
                role: "admin",
                first_name: "John",
                last_name: "Doe",
                phone: "+15551234567",
            });

            expect(result).toEqual(mockUser);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "create-organization-user",
                {
                    body: {
                        organization_id: "org-1",
                        email: "newuser@example.com",
                        role: "admin",
                        first_name: "John",
                        last_name: "Doe",
                        phone: "+15551234567",
                    },
                },
            );
        });

        it("should handle existing user response", async () => {
            const mockUser = createMockOrganizationUser();

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    organization_user: mockUser,
                    existing_user: true,
                    message: "User already has an account",
                },
                error: null,
            });

            const result = await OrganizationUsersService.create({
                organization_id: "org-1",
                email: "existing@example.com",
                role: "viewer",
                first_name: "Jane",
                last_name: "Smith",
            });

            expect(result).toEqual(mockUser);
        });
    });

    describe("update with new fields", () => {
        it("should update organization user with name and phone", async () => {
            const mockUser = createMockOrganizationUser({
                first_name: "Updated",
                last_name: "Name",
                phone: "+15559876543",
            });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    organization_user: mockUser,
                },
                error: null,
            });

            const result = await OrganizationUsersService.update({
                id: "user-1",
                first_name: "Updated",
                last_name: "Name",
                phone: "+15559876543",
            });

            expect(result.first_name).toBe("Updated");
            expect(result.last_name).toBe("Name");
            expect(result.phone).toBe("+15559876543");
        });

        it("should update only role", async () => {
            const mockUser = createMockOrganizationUser({ role: "viewer" });

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    organization_user: mockUser,
                },
                error: null,
            });

            const result = await OrganizationUsersService.update({
                id: "user-1",
                role: "viewer",
            });

            expect(result.role).toBe("viewer");
        });
    });

    describe("list with new fields", () => {
        it("should return organization users with all new fields", async () => {
            const mockUsers = [
                createMockOrganizationUser({ id: "user-1", status: "active" }),
                createMockOrganizationUser({
                    id: "user-2",
                    email: "pending@example.com",
                    status: "pending",
                    auth_user_id: null,
                    activated_at: null,
                }),
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    organization_users: mockUsers,
                },
                error: null,
            });

            const result = await OrganizationUsersService.list({
                organization_id: "org-1",
            });

            expect(result.organization_users).toHaveLength(2);
            expect(result.organization_users[0].status).toBe("active");
            expect(result.organization_users[0].first_name).toBe("John");
            expect(result.organization_users[1].status).toBe("pending");
            expect(result.organization_users[1].auth_user_id).toBeNull();
        });
    });
});
