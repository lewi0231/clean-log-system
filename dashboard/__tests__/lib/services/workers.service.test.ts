import { WorkersService } from "@/lib/services/workers.service";
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

describe("WorkersService", () => {
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

      const result = await WorkersService.listWorkersAndLocations({
        organization_id: "org-1",
      });

      expect(result.success).toBe(true);
      expect(result.workers).toEqual(mockWorkers);
      expect(result.locations).toEqual(mockLocations);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "list-workers-and-locations",
        {
          body: { organization_id: "org-1" },
        }
      );
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        WorkersService.listWorkersAndLocations({
          organization_id: "org-1",
        })
      ).rejects.toEqual(mockError);
    });

    it("should throw error when success flag is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { workers: [], locations: [] },
        error: null,
      });

      await expect(
        WorkersService.listWorkersAndLocations({
          organization_id: "org-1",
        })
      ).rejects.toThrow("Failed to fetch workers and locations");
    });

    it("should throw error when data is null", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        WorkersService.listWorkersAndLocations({
          organization_id: "org-1",
        })
      ).rejects.toThrow("Failed to fetch workers and locations");
    });
  });

  describe("create", () => {
    it("should return created worker on success", async () => {
      const mockWorker = createMockWorker();
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { worker: mockWorker },
        error: null,
      });

      const result = await WorkersService.create({
        organization_id: "org-1",
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
      });

      expect(result).toEqual(mockWorker);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("create-worker", {
        body: {
          organization_id: "org-1",
          name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Creation failed", status: 400 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        WorkersService.create({
          organization_id: "org-1",
          name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
        })
      ).rejects.toEqual(mockError);
    });

    it("should throw error when worker is missing in response", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(
        WorkersService.create({
          organization_id: "org-1",
          name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
        })
      ).rejects.toThrow("Failed to create worker");
    });
  });

  describe("update", () => {
    it("should return updated worker on success", async () => {
      const mockWorker = createMockWorker({ name: "Jane Doe" });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { worker: mockWorker },
        error: null,
      });

      const result = await WorkersService.update({
        id: "worker-1",
        name: "Jane Doe",
      });

      expect(result).toEqual(mockWorker);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("update-worker", {
        body: {
          id: "worker-1",
          name: "Jane Doe",
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Update failed", status: 400 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        WorkersService.update({
          id: "worker-1",
          name: "Jane Doe",
        })
      ).rejects.toEqual(mockError);
    });

    it("should throw error when worker is missing in response", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {},
        error: null,
      });

      await expect(
        WorkersService.update({
          id: "worker-1",
          name: "Jane Doe",
        })
      ).rejects.toThrow("Failed to update worker");
    });
  });

  describe("delete", () => {
    it("should succeed when deletion is successful", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {},
        error: null,
      });

      await WorkersService.delete({ id: "worker-1" });

      expect(supabase.functions.invoke).toHaveBeenCalledWith("delete-worker", {
        body: { id: "worker-1" },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Deletion failed", status: 400 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(WorkersService.delete({ id: "worker-1" })).rejects.toEqual(
        mockError
      );
    });
  });
});
