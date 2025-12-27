import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

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
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  countryCode?: string; // Default: "AU" for Australia
  onFocus?: () => void;
}

/**
 * AddressAutocomplete - An address input component with Geoapify autocomplete for React Native
 *
 * Uses the same Geoapify API as the dashboard implementation for consistency.
 *
 * @requires EXPO_PUBLIC_GEOAPIFY_API_KEY environment variable
 *
 * Features:
 * - Real-time address suggestions as user types
 * - Debounced API calls (400ms) to reduce requests
 * - Australia-focused by default (can be customized via countryCode prop)
 * - Graceful degradation if API key is missing
 * - Loading and error states
 */
export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address...",
  disabled = false,
  error = false,
  countryCode = "AU",
  onFocus,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeoapifyAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<View>(null);

  // Get API key from environment (EXPO_PUBLIC_ prefix for Expo)
  // Try multiple methods to access env vars (Expo can be inconsistent)
  const apiKey =
    (typeof process !== "undefined" &&
      process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY) ||
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY) ||
    Constants.expoConfig?.extra?.EXPO_PUBLIC_GEOAPIFY_API_KEY ||
    Constants.expoConfig?.extra?.geoapifyApiKey ||
    undefined;

  // Feature flag: disable autocomplete if explicitly set to false
  const isEnabled =
    Constants.expoConfig?.extra?.enableAddressAutocomplete !== false;

  // Debug logging (only in development)
  useEffect(() => {
    if (__DEV__) {
      console.log("[AddressAutocomplete] Config:", {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : "none",
        isEnabled,
        envSources: {
          processEnvExpo: !!(
            typeof process !== "undefined" &&
            process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY
          ),
          processEnvNext: !!(
            typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
          ),
          constantsExtra:
            !!Constants.expoConfig?.extra?.EXPO_PUBLIC_GEOAPIFY_API_KEY,
        },
      });

      if (!apiKey) {
        console.warn(
          "[AddressAutocomplete] API key not found. " +
            "Add EXPO_PUBLIC_GEOAPIFY_API_KEY to your .env file and restart Expo dev server."
        );
      }
      if (!isEnabled) {
        console.log(
          "[AddressAutocomplete] Disabled via feature flag (enableAddressAutocomplete: false)"
        );
      }
    }
  }, [apiKey, isEnabled]);

  // Sync local value with prop value
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || "");
    }
  }, [value]);

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
      // Check feature flag first
      if (!isEnabled) {
        if (__DEV__) {
          console.log(
            "[AddressAutocomplete] Autocomplete disabled via feature flag"
          );
        }
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      if (!apiKey) {
        if (__DEV__) {
          console.warn(
            "[AddressAutocomplete] API key not configured. Skipping fetch."
          );
        }
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      if (!query.trim() || query.trim().length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Avoid URLSearchParams in RN/Hermes (can be inconsistent without polyfills)
        const q = query.trim();

        // Build URL with proper encoding
        // Note: Geoapify filter format is countrycode:au (lowercase, no spaces)
        const filterParam = `countrycode:${countryCode.toLowerCase()}`;
        const url =
          "https://api.geoapify.com/v1/geocode/autocomplete" +
          `?apiKey=${encodeURIComponent(apiKey)}` +
          `&text=${encodeURIComponent(q)}` +
          `&limit=5` +
          `&filter=${encodeURIComponent(filterParam)}` +
          `&format=json`;

        if (__DEV__) {
          console.log("[AddressAutocomplete] Fetching:", {
            url: url.replace(apiKey, "***"),
            query: q,
            countryCode,
            filterParam,
            encodedFilter: encodeURIComponent(filterParam),
          });
        }

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (__DEV__) {
          console.log("[AddressAutocomplete] Response:", {
            status: response.status,
            ok: response.ok,
          });
        }

        if (!response.ok) {
          if (response.status === 429) {
            console.warn("Geoapify rate limit reached");
          } else if (response.status === 401 || response.status === 403) {
            console.error(
              "Geoapify API key authentication failed. Please check your API key."
            );
          } else {
            console.error(
              `Geoapify API error (${response.status}):`,
              await response.text().catch(() => "Unknown error")
            );
          }
          setSuggestions([]);
          return;
        }

        const data = (await response.json()) as {
          features?: GeoapifyAddress[];
          type?: string;
        };

        // Debug: Log full response to understand structure
        if (__DEV__) {
          console.log("[AddressAutocomplete] Full API response:", {
            hasFeatures: !!data.features,
            featuresCount: data.features?.length || 0,
            type: data.type,
            firstFeature: data.features?.[0],
            fullResponseKeys: Object.keys(data),
          });
        }

        // Geoapify returns GeoJSON with features array
        // Each feature has: { type: "Feature", properties: {...}, geometry: {...} }
        const features: GeoapifyAddress[] = data.features || [];

        if (__DEV__) {
          if (features.length > 0) {
            console.log("[AddressAutocomplete] Results:", {
              count: features.length,
              firstResult: features[0].properties?.formatted,
              firstResultDetails: {
                formatted: features[0].properties?.formatted,
                address_line1: features[0].properties?.address_line1,
                city: features[0].properties?.city,
                state: features[0].properties?.state,
              },
            });
          } else {
            console.warn(
              "[AddressAutocomplete] No suggestions returned for query:",
              query.trim()
            );
          }
        }

        setSuggestions(features);
        setIsOpen(features.length > 0);
      } catch (error) {
        if (__DEV__) {
          console.error("[AddressAutocomplete] Fetch error:", error);
          if (error instanceof TypeError && error.message.includes("fetch")) {
            console.error(
              "[AddressAutocomplete] Network error - check internet connection and API endpoint"
            );
          }
        }
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, countryCode, isEnabled]
  );

  const handleInputChange = (text: string) => {
    setLocalValue(text);
    onChange(text);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // If query is too short, close dropdown immediately
    if (text.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // Debounce API calls (wait 400ms after user stops typing)
    // Only show loading when we actually trigger the fetch
    debounceTimeoutRef.current = setTimeout(() => {
      const trimmedText = text.trim();
      if (__DEV__) {
        console.log(
          "[AddressAutocomplete] Debounced fetch triggered for:",
          trimmedText
        );
      }
      if (trimmedText.length >= 3) {
        // Set loading right before fetch
        setIsLoading(true);
        fetchSuggestions(trimmedText);
      } else {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
      }
    }, 400) as unknown as NodeJS.Timeout;
  };

  const handleSelectSuggestion = (suggestion: GeoapifyAddress) => {
    const fullAddress = suggestion.properties.formatted;
    setLocalValue(fullAddress);
    onChange(fullAddress);
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleBlur = () => {
    // Small delay to allow press events on suggestions to fire first
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  return (
    <View ref={containerRef} className="relative">
      <View
        className={`bg-card border rounded-xl overflow-hidden ${
          error ? "border-destructive" : "border-border"
        }`}
      >
        <View className="flex-row items-center">
          <View className="ml-3">
            <Ionicons
              name="location-outline"
              size={20}
              color={disabled ? "#6b7280" : "#9ca3af"}
            />
          </View>
          <TextInput
            className="flex-1 bg-transparent text-card-foreground px-4 py-3.5 text-base"
            placeholder={placeholder}
            placeholderTextColor="#6b7280"
            value={localValue}
            onChangeText={handleInputChange}
            onBlur={handleBlur}
            onFocus={() => {
              onFocus?.();
              if (suggestions.length > 0) {
                setIsOpen(true);
              }
            }}
            editable={!disabled}
            autoCapitalize="words"
            autoComplete="street-address"
            style={{ opacity: disabled ? 0.5 : 1 }}
          />
          {isLoading && (
            <View className="mr-3">
              <ActivityIndicator size="small" color="#9ca3af" />
            </View>
          )}
        </View>
      </View>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <View className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60">
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.properties.place_id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectSuggestion(item)}
                className="px-4 py-3 border-b border-border active:bg-muted"
              >
                <Text className="text-card-foreground text-base font-medium">
                  {item.properties.formatted}
                </Text>
                {item.properties.address_line2 && (
                  <Text className="text-muted-foreground text-sm mt-1">
                    {item.properties.address_line2}
                  </Text>
                )}
              </Pressable>
            )}
            ItemSeparatorComponent={() => (
              <View className="h-px bg-border mx-4" />
            )}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
}
