"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFieldConfigs } from "@/hooks/use-field-configs";

interface PricingScopeValue {
  selectedFieldId: string | null;
  setSelectedFieldId: (fieldId: string | null) => void;
  locationNodeId: string | null;
  setLocationNodeId: (nodeId: string | null) => void;
  locationId: string | null;
  setLocationId: (locationId: string | null) => void;
  effectiveDate: string | null;
  setEffectiveDate: (date: string | null) => void;
  expirationDate: string | null;
  setExpirationDate: (date: string | null) => void;
  pricingHistoryRefreshToken: number;
  refreshPricingHistory: () => void;
  pricingContext: "customer" | "worker";
  setPricingContext: (context: "customer" | "worker") => void;
  showBothContexts: boolean;
  setShowBothContexts: (show: boolean) => void;
  fieldLabelLookup: Record<string, string>;
}

const PricingScopeContext = createContext<PricingScopeValue | undefined>(
  undefined
);

interface PricingScopeProviderProps {
  children: ReactNode;
  initialLocationNodeId?: string | null;
  initialLocationId?: string | null;
  initialEffectiveDate?: string | null;
}

export function PricingScopeProvider({
  children,
  initialLocationNodeId = null,
  initialLocationId = null,
  initialEffectiveDate,
}: PricingScopeProviderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [locationNodeId, setLocationNodeId] = useState<string | null>(
    initialLocationNodeId
  );
  const [locationId, setLocationId] = useState<string | null>(
    initialLocationId
  );
  // Default effective date to today's date (YYYY-MM-DD format for HTML date input)
  // Only default if initialEffectiveDate is not provided (undefined)
  // If explicitly null, respect that (allows clearing the date)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [effectiveDate, setEffectiveDate] = useState<string | null>(
    initialEffectiveDate !== undefined ? initialEffectiveDate : getTodayDate()
  );
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [pricingHistoryRefreshToken, setPricingHistoryRefreshToken] =
    useState(0);
  const [pricingContext, setPricingContext] = useState<"customer" | "worker">("customer");
  const [showBothContexts, setShowBothContexts] = useState(false);

  const { fieldConfigs } = useFieldConfigs();

  const fieldLabelLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    fieldConfigs.forEach((fc) => {
      lookup[fc.id] = fc.label;
    });
    return lookup;
  }, [fieldConfigs]);

  const refreshPricingHistory = useCallback(() => {
    setPricingHistoryRefreshToken((prev) => prev + 1);
  }, []);

  const value = useMemo<PricingScopeValue>(
    () => ({
      selectedFieldId,
      setSelectedFieldId,
      locationNodeId,
      setLocationNodeId,
      locationId,
      setLocationId,
      effectiveDate,
      setEffectiveDate,
      expirationDate,
      setExpirationDate,
      pricingHistoryRefreshToken,
      refreshPricingHistory,
      pricingContext,
      setPricingContext,
      showBothContexts,
      setShowBothContexts,
      fieldLabelLookup,
    }),
    [
      selectedFieldId,
      locationNodeId,
      locationId,
      effectiveDate,
      expirationDate,
      pricingHistoryRefreshToken,
      refreshPricingHistory,
      pricingContext,
      showBothContexts,
      fieldLabelLookup,
    ]
  );

  return (
    <PricingScopeContext.Provider value={value}>
      {children}
    </PricingScopeContext.Provider>
  );
}

export function usePricingScope() {
  const context = useContext(PricingScopeContext);
  if (!context) {
    throw new Error(
      "usePricingScope must be used within a PricingScopeProvider"
    );
  }
  return context;
}

export function usePricingScopeSelectors() {
  const {
    setSelectedFieldId,
    setLocationNodeId,
    setLocationId,
    setEffectiveDate,
    setExpirationDate,
    ...rest
  } = usePricingScope();

  return {
    ...rest,
    selectField: useCallback(
      (fieldId: string | null) => setSelectedFieldId(fieldId),
      [setSelectedFieldId]
    ),
    selectLocationNode: useCallback(
      (nodeId: string | null) => setLocationNodeId(nodeId),
      [setLocationNodeId]
    ),
    selectLocation: useCallback(
      (locationId: string | null) => setLocationId(locationId),
      [setLocationId]
    ),
    selectEffectiveDate: useCallback(
      (date: string | null) => setEffectiveDate(date),
      [setEffectiveDate]
    ),
    selectExpirationDate: useCallback(
      (date: string | null) => setExpirationDate(date),
      [setExpirationDate]
    ),
  };
}
