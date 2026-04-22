"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { log } from "@/lib/logger";
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
 * @status RESERVED - This component is not currently in use but is reserved for future implementation.
 *
 * @future-use
 * - Mobile config: Address field autocomplete in form builder
 * - Mobile app: Address field autocomplete for workers entering addresses
 * - Customer portal: Address input for customer-facing forms
 *
 * @requires NEXT_PUBLIC_GEOAPIFY_API_KEY environment variable
 *
 * Features:
 * - Real-time address suggestions as user types
 * - Debounced API calls (400ms) to reduce requests
 * - Auto-saves selected address on selection or blur
 * - Australia-focused by default (can be customized via countryCode prop)
 * - Graceful degradation if API key is missing
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Loading and error states
 *
 * @example
 * ```tsx
 * <AddressAutocomplete
 *   label="Business Address"
 *   value={address}
 *   onSave={handleAddressSave}
 *   placeholder="Start typing an address..."
 *   countryCode="AU"
 * />
 * ```
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
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY : undefined;

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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
      const debug = process.env.NEXT_PUBLIC_ADDRESS_AUTOCOMPLETE_DEBUG === "true";

      if (!apiKey) {
        log.warn("AddressAutocomplete: Geoapify API key not configured", {
          hasKey: false,
        });
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
      if (debug) {
        // Never log the raw query; it can contain customer addresses.
        log.debug("AddressAutocomplete: Fetching Geoapify suggestions", {
          queryLength: query.trim().length,
          countryCode,
        });
      }

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
            log.warn("AddressAutocomplete: Geoapify rate limit reached", {
              status: response.status,
            });
          } else if (response.status === 401 || response.status === 403) {
            log.error("AddressAutocomplete: Geoapify auth failed", {
              status: response.status,
            });
          } else {
            const errorText = await response.text().catch(() => "Unknown error");
            log.error("AddressAutocomplete: Geoapify API error", {
              status: response.status,
              error: errorText,
            });
          }
          setSuggestions([]);
          return;
        }

        const data = await response.json();

        if (debug) {
          log.debug("AddressAutocomplete: Geoapify response received", {
            hasFeatures: !!data.features,
            featuresCount: data.features?.length || 0,
          });
        }

        // Geoapify returns GeoJSON with features array
        // Each feature has: { type: "Feature", properties: {...}, geometry: {...} }
        const features: GeoapifyAddress[] = data.features || [];

        if (debug) {
          log.debug("AddressAutocomplete: Suggestions updated", {
            count: features.length,
          });
        }

        setSuggestions(features);
        setIsOpen(features.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        // NetworkError typically indicates CORS or network connectivity issues
        if (error instanceof TypeError && error.message.includes("fetch")) {
          log.error("AddressAutocomplete: Geoapify request failed (likely CORS)", {
            error: error.message,
          });
        } else {
          log.error("AddressAutocomplete: Error fetching suggestions", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
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
      log.error("Error saving address:", error);
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
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
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
      log.error("Error saving address:", error);
      setLocalValue(value || "");
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
    }
  };

  const inputId =
    id || `address-autocomplete-${label?.toLowerCase().replace(/\s+/g, "-") || "input"}`;

  // If no API key, fall back to regular input behavior
  const hasAutocomplete = !!apiKey;

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      {label && (
        <Label htmlFor={inputId} className="flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
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
              selectedIndex >= 0 ? `${inputId}-suggestion-${selectedIndex}` : undefined
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
                    selectedIndex === index && "bg-accent text-accent-foreground"
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
                  {suggestion.properties.city && suggestion.properties.state && (
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
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {!hasAutocomplete && (
        <p className="text-xs text-muted-foreground italic">
          Address autocomplete is not available. Please enter address manually.
        </p>
      )}
    </div>
  );
}
