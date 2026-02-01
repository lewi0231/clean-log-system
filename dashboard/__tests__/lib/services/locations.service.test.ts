import { LocationsService } from "@/lib/services/locations.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLocation, createMockWorker } from "../fixtures";

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

describe("LocationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listWorkersAndLocations", () => {
    it("should return workers and locations on success", async () => {
      const mockWorkers = [createMockWorker()];
      const mockLocations = [createMockLocation()];

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          workers: mockWorkers,
          locations: mockLocations,
        },
        error: null,
      });

      const result = await LocationsService.listWorkersAndLocations({
        organization_id: "org-1",
      });

      expect(result.success).toBe(true);
      expect(result.workers).toEqual(mockWorkers);
      expect(result.locations).toEqual(mockLocations);
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        LocationsService.listWorkersAndLocations({
          organization_id: "org-1",
        })
      ).rejects.toMatchObject(mockError);
    });
  });

  describe("create", () => {
    it("should return created location on success", async () => {
      const mockLocation = createMockLocation();
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { location: mockLocation },
        error: null,
      });

      const result = await LocationsService.create({
        organization_id: "org-1",
        name: "Main Office",
        email: "office@example.com",
        address: "123 Main St",
        contact_person: "John Doe",
      });

      expect(result).toEqual(mockLocation);
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Creation failed", status: 400 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        LocationsService.create({
          organization_id: "org-1",
          name: "Main Office",
          email: "office@example.com",
          address: "123 Main St",
          contact_person: "John Doe",
        })
      ).rejects.toMatchObject(mockError);
    });

    it("should throw error when location is missing in response", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(
        LocationsService.create({
          organization_id: "org-1",
          name: "Main Office",
          email: "office@example.com",
          address: "123 Main St",
          contact_person: "John Doe",
        })
      ).rejects.toThrow("Failed to create location");
    });
  });

  describe("update", () => {
    it("should return updated location on success", async () => {
      const mockLocation = createMockLocation({ name: "Updated Office" });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { location: mockLocation },
        error: null,
      });

      const result = await LocationsService.update({
        id: "location-1",
        name: "Updated Office",
      });

      expect(result).toEqual(mockLocation);
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Update failed", status: 400 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        LocationsService.update({
          id: "location-1",
          name: "Updated Office",
        })
      ).rejects.toMatchObject(mockError);
    });
  });

  describe("delete", () => {
    it("should succeed when deletion is successful", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {},
        error: null,
      });

      await LocationsService.delete({ id: "location-1" });

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "delete-location",
        {
          body: { id: "location-1" },
        }
      );
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Deletion failed", status: 400 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        LocationsService.delete({ id: "location-1" })
      ).rejects.toMatchObject(mockError);
    });
  });
});
