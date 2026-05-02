import LocationsPage from "@/app/dashboard/locations/page";
import { useLocations } from "@/hooks/use-locations";
import useOrganization from "@/hooks/useOrganization";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLocation } from "../../lib/fixtures";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
}

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

// Mock tour components
vi.mock("@/components/tours/page-tour-wrapper", () => ({
  PageTourWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/tours/tour-trigger-button", () => ({
  TourTriggerButton: () => <button>Start Tour</button>,
}));

// Mock hooks
vi.mock("@/hooks/useOrganization", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/use-locations", () => ({
  useLocations: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("LocationsPage", () => {
  const mockCreateLocation = vi.fn();
  const mockUpdateLocation = vi.fn();
  const mockDeleteLocation = vi.fn();

  const mockRefetchLocations = vi.fn();

  const defaultUseOrganization = {
    organizationId: "org-1",
    organizationUserId: "ou-1",
    userRole: "admin",
    loading: false,
    error: undefined as string | undefined,
  };

  const defaultUseLocations = {
    locations: [],
    loading: false,
    error: null,
    refetch: mockRefetchLocations,
    createLocation: mockCreateLocation,
    updateLocation: mockUpdateLocation,
    deleteLocation: mockDeleteLocation,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrganization).mockReturnValue(defaultUseOrganization);
    vi.mocked(useLocations).mockReturnValue(defaultUseLocations);
  });

  describe("Rendering", () => {
    it("should render locations page", () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByText("Locations")).toBeInTheDocument();
      expect(screen.getByText(/Manage customer sites and optional hierarchy/)).toBeInTheDocument();
    });

    it("should render loading state when organization is loading", () => {
      vi.mocked(useOrganization).mockReturnValue({
        ...defaultUseOrganization,
        loading: true,
      });

      render(<LocationsPage />, { wrapper: createWrapper() });

      // Should show skeleton loaders
      expect(screen.queryByText("Locations")).not.toBeInTheDocument();
    });

    it("should render error state when organization error", () => {
      vi.mocked(useOrganization).mockReturnValue({
        ...defaultUseOrganization,
        error: "Failed to load organization",
      });

      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByText("Failed to load organization")).toBeInTheDocument();
    });

    it("should render error state when organization ID is missing", () => {
      vi.mocked(useOrganization).mockReturnValue({
        organizationId: null,
        organizationUserId: null,
        userRole: null,
        loading: false,
        error: undefined,
      });

      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByText("Failed to load organization")).toBeInTheDocument();
    });

    it("should render locations tab by default", () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByRole("tab", { name: /customer locations/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /location hierarchy/i })).toBeInTheDocument();
    });
  });

  describe("Tab Switching", () => {
    it("should switch between Customer Locations and Location Hierarchy tabs", async () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      const hierarchyTab = screen.getByRole("tab", {
        name: /location hierarchy/i,
      });
      fireEvent.click(hierarchyTab);

      await waitFor(() => {
        expect(screen.getByText("Location Hierarchy")).toBeInTheDocument();
      });
    });

    it("should display Customer Locations tab content", () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByRole("tab", { name: /customer locations/i })).toBeInTheDocument();
    });
  });

  describe("Location Management", () => {
    it("should open location form when Add Location is clicked", async () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      const addButton = screen.getByRole("button", { name: /add location/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        // Use getByRole to find the dialog heading specifically
        expect(screen.getByRole("heading", { name: /add location/i })).toBeInTheDocument();
      });
    });

    it("should handle location creation", async () => {
      mockCreateLocation.mockResolvedValue(createMockLocation());

      render(<LocationsPage />, { wrapper: createWrapper() });

      const addButton = screen.getByRole("button", { name: /add location/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        // Use getByRole to find the dialog heading specifically
        expect(screen.getByRole("heading", { name: /add location/i })).toBeInTheDocument();
      });

      // Fill form
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "New Location" },
      });
      fireEvent.change(screen.getByLabelText("Contact Email"), {
        target: { value: "new@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: "123 Main St" },
      });
      fireEvent.change(screen.getByLabelText("Contact Person"), {
        target: { value: "John Doe" },
      });

      const submitButton = screen.getByRole("button", { name: /create/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateLocation).toHaveBeenCalledWith(
          expect.objectContaining({
            organization_id: "org-1",
            name: "New Location",
            email: "new@example.com",
            address: "123 Main St",
            contact_person: "John Doe",
          })
        );
      });
    });

    it("should handle location update", async () => {
      const location = createMockLocation({ id: "location-1" });
      vi.mocked(useLocations).mockReturnValue({
        ...defaultUseLocations,
        locations: [location],
      });
      mockUpdateLocation.mockResolvedValue(location);

      render(<LocationsPage />, { wrapper: createWrapper() });

      // Find and click edit button
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector('svg[class*="pencil"]'));

      if (editButton) {
        fireEvent.click(editButton);

        await waitFor(() => {
          expect(screen.getByRole("heading", { name: /edit location/i })).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText("Name");
        fireEvent.change(nameInput, { target: { value: "Updated Location" } });

        const submitButton = screen.getByRole("button", { name: /update/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          // The hook's updateLocation receives a single object with id included
          expect(mockUpdateLocation).toHaveBeenCalledWith(
            expect.objectContaining({
              id: "location-1",
              name: "Updated Location",
            })
          );
        });
      }
    });

    it("should handle location deletion", async () => {
      const location = createMockLocation({ id: "location-1", name: "Test Location" });
      vi.mocked(useLocations).mockReturnValue({
        ...defaultUseLocations,
        locations: [location],
      });
      mockDeleteLocation.mockResolvedValue(undefined);

      render(<LocationsPage />, { wrapper: createWrapper() });

      // Find and click delete button
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) => btn.querySelector('svg[class*="trash"]'));

      if (deleteButton) {
        fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole("button", { name: /^delete$/i });
        fireEvent.click(confirmButton);

        // Wait a bit for the async operation
        // The hook's deleteLocation receives { id: string }, not just the string
        await waitFor(
          () => {
            expect(mockDeleteLocation).toHaveBeenCalledWith({ id: "location-1" });
          },
          { timeout: 2000 }
        );
      }
    });
  });

  describe("Location List Display", () => {
    it("should display locations in table", () => {
      const locations = [
        createMockLocation({ name: "Location 1" }),
        createMockLocation({ name: "Location 2", id: "location-2" }),
      ];

      vi.mocked(useLocations).mockReturnValue({
        ...defaultUseLocations,
        locations,
      });

      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByText("Location 1")).toBeInTheDocument();
      expect(screen.getByText("Location 2")).toBeInTheDocument();
    });

    it("should display empty state when no locations", () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(
        screen.getByText("No locations found. Add your first location to get started.")
      ).toBeInTheDocument();
    });

    it("should display loading state", () => {
      vi.mocked(useLocations).mockReturnValue({
        ...defaultUseLocations,
        loading: true,
      });

      render(<LocationsPage />, { wrapper: createWrapper() });

      // Should show skeleton
      expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
    });

    it("should display error state", () => {
      vi.mocked(useLocations).mockReturnValue({
        ...defaultUseLocations,
        error: "Failed to load locations",
      });

      render(<LocationsPage />, { wrapper: createWrapper() });

      expect(screen.getByText("Error: Failed to load locations")).toBeInTheDocument();
    });
  });

  describe("Location Hierarchy Tab", () => {
    it("should display location hierarchy manager in hierarchy tab", async () => {
      render(<LocationsPage />, { wrapper: createWrapper() });

      const hierarchyTab = screen.getByRole("tab", {
        name: /location hierarchy/i,
      });
      fireEvent.click(hierarchyTab);

      await waitFor(() => {
        expect(screen.getByText("Location Hierarchy")).toBeInTheDocument();
      });
    });
  });
});
