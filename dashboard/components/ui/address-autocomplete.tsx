"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface GeoapifyAddress {
  properties: {
    place_id: string;
    formatted: string;
    address_line1: string;
    address_line2: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    housenumber?: string;
    street?: string;
    lat: number;
    lon: number;
  };
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
}

interface AddressAutocompleteProps {
  label?: string;
  value: string | null;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  id?: string;
  countryCode?: string; // Default: "AU" for Australia
  disabled?: boolean;
}

/**
 * AddressAutocomplete - An address input component with Geoapify autocomplete
 *
 * Features:
 * - Real-time address suggestions as user types
 * - Debounced API calls to reduce requests
 * - Auto-saves selected address
 * - Australia-focused by default (can be customized)
 * - Graceful degradation if API key is missing
 */
export function AddressAutocomplete({
  label,
  value,
  onSave,
  placeholder = "Start typing an address...",
  description,
  required = false,
  className,
  id,
  countryCode = "AU",
  disabled = false,
}: AddressAutocompleteProps) {
  const [localValue, setLocalValue] = useState<string>(value || "");
  const [suggestions, setSuggestions] = useState<GeoapifyAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLUListElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Get API key from environment (must be prefixed with NEXT_PUBLIC_ for client-side access)
  const apiKey =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
      : undefined;

  // Sync local value with prop value (but only if user isn't actively editing)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!hasUnsavedChanges) {
      setLocalValue(value || "");
    }
  }, [value, hasUnsavedChanges]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!apiKey) {
        console.warn(
          "Geoapify API key not configured. Add NEXT_PUBLIC_GEOAPIFY_API_KEY to your environment variables."
        );
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      if (!query.trim() || query.trim().length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      console.log("Fetching Geoapify suggestions for query:", query.trim());

      try {
        const params = new URLSearchParams({
          apiKey: apiKey,
          text: query.trim(),
          limit: "5",
          filter: `countrycode:${countryCode.toLowerCase()}`,
          format: "json",
        });

        const url = `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          // Handle rate limiting or other errors gracefully
          if (response.status === 429) {
            console.warn("Geoapify rate limit reached");
          } else if (response.status === 401 || response.status === 403) {
            console.error(
              "Geoapify API key authentication failed. Please check your API key and CORS settings in Geoapify dashboard."
            );
          } else {
            const errorText = await response
              .text()
              .catch(() => "Unknown error");
            console.error(
              `Geoapify API error (${response.status}):`,
              errorText
            );
          }
          setSuggestions([]);
          return;
        }

        const data = await response.json();

        // Debug: Log full response to understand structure
        console.log("Geoapify API response:", {
          hasFeatures: !!data.features,
          featuresCount: data.features?.length || 0,
          firstFeature: data.features?.[0],
          fullResponse: data,
        });

        // Geoapify returns GeoJSON with features array
        // Each feature has: { type: "Feature", properties: {...}, geometry: {...} }
        const features: GeoapifyAddress[] = data.features || [];

        if (features.length > 0) {
          console.log("Geoapify suggestions received:", features.length);
          console.log("First suggestion:", {
            formatted: features[0].properties?.formatted,
            address_line1: features[0].properties?.address_line1,
            city: features[0].properties?.city,
            state: features[0].properties?.state,
          });
        } else {
          console.warn("Geoapify returned no suggestions for query:", query);
        }

        setSuggestions(features);
        setIsOpen(features.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        // NetworkError typically indicates CORS or network connectivity issues
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.error(
            "Geoapify API request failed. This is likely a CORS issue. Please check:",
            "\n1. Your API key is set correctly (NEXT_PUBLIC_GEOAPIFY_API_KEY)",
            "\n2. CORS is configured in Geoapify dashboard to allow requests from your domain",
            "\n3. Your API key doesn't have IP address restrictions that block your current IP",
            "\nError details:",
            error
          );
        } else {
          console.error("Error fetching address suggestions:", error);
        }
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, countryCode]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setHasUnsavedChanges(true);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // If query is too short, close dropdown immediately
    if (newValue.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Debounce API calls (wait 400ms after user stops typing)
    // This prevents excessive API calls while user is typing
    debounceTimeoutRef.current = setTimeout(() => {
      if (newValue.trim().length >= 3) {
        fetchSuggestions(newValue);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
    }, 400);
  };

  const handleSelectSuggestion = async (suggestion: GeoapifyAddress) => {
    const fullAddress = suggestion.properties.formatted;
    setLocalValue(fullAddress);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setHasUnsavedChanges(false);

    // Save the selected address
    setIsSaving(true);
    try {
      await onSave(fullAddress);
    } catch (error) {
      console.error("Error saving address:", error);
      // Restore previous value on error
      setLocalValue(value || "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = async () => {
    // Small delay to allow click events on suggestions to fire first
    setTimeout(async () => {
      setIsOpen(false);
      setSelectedIndex(-1);

      // Save current value on blur if there are unsaved changes
      // This handles the case where autocomplete is disabled or user typed manually
      if (hasUnsavedChanges) {
        await handleSaveCurrentValue();
      }
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter" && hasUnsavedChanges) {
        // Save current value on Enter if no suggestions
        handleSaveCurrentValue();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          // Select first suggestion if none is selected
          handleSelectSuggestion(suggestions[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSaveCurrentValue = async () => {
    if (!hasUnsavedChanges) return;

    const trimmedValue = localValue.trim();
    setIsSaving(true);
    setHasUnsavedChanges(false);

    try {
      await onSave(trimmedValue || "");
    } catch (error) {
      console.error("Error saving address:", error);
      setLocalValue(value || "");
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
    }
  };

  const inputId =
    id ||
    `address-autocomplete-${
      label?.toLowerCase().replace(/\s+/g, "-") || "input"
    }`;

  // If no API key, fall back to regular input behavior
  const hasAutocomplete = !!apiKey;

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      {label && (
        <Label htmlFor={inputId} className="flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
          {isSaving && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </Label>
      )}
      <div className="relative">
        <div className="relative">
          <Input
            ref={inputRef}
            id={inputId}
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setIsOpen(true);
              }
            }}
            disabled={disabled || isSaving}
            placeholder={placeholder}
            aria-autocomplete={hasAutocomplete ? "list" : "none"}
            aria-expanded={isOpen}
            aria-controls={isOpen ? `${inputId}-suggestions` : undefined}
            aria-activedescendant={
              selectedIndex >= 0
                ? `${inputId}-suggestion-${selectedIndex}`
                : undefined
            }
            className="pr-10"
          />
          {hasAutocomplete && (
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>

        {/* Suggestions Dropdown */}
        {hasAutocomplete && isOpen && suggestions.length > 0 && (
          <ul
            ref={suggestionListRef}
            id={`${inputId}-suggestions`}
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading && (
              <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </li>
            )}
            {!isLoading &&
              suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.properties.place_id}
                  id={`${inputId}-suggestion-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  className={cn(
                    "px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                    selectedIndex === index &&
                      "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleSelectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="font-medium text-sm">
                    {suggestion.properties.formatted ||
                      suggestion.properties.address_line1 ||
                      "Address"}
                  </div>
                  {suggestion.properties.city &&
                    suggestion.properties.state && (
                      <div className="text-xs text-muted-foreground truncate">
                        {[
                          suggestion.properties.city,
                          suggestion.properties.state,
                          suggestion.properties.postcode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                </li>
              ))}
          </ul>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {!hasAutocomplete && (
        <p className="text-xs text-muted-foreground italic">
          Address autocomplete is not available. Please enter address manually.
        </p>
      )}
    </div>
  );
}
