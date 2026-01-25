"use client";

import { useState } from "react";

interface UseFieldPricingCardStateResult {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  isDeleting: boolean;
  setIsDeleting: (deleting: boolean) => void;
}

/**
 * Hook to manage UI state for a single field pricing card.
 * Each card instance has independent state for expanded, saving, and deleting.
 *
 * @param fieldId - The ID of the field config this card represents
 * @returns State and setters for the card's UI state
 */
export function useFieldPricingCardState(
  fieldId: string
): UseFieldPricingCardStateResult {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return {
    isExpanded,
    setIsExpanded,
    isSaving,
    setIsSaving,
    isDeleting,
    setIsDeleting,
  };
}
