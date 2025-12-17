/**
 * Rating Configuration Constants
 * Defines preset rating configurations based on industry best practices
 */

import type { RatingConfig, RatingConfigType } from "@/lib/types";

/**
 * Rating dimension labels for display
 */
export const RATING_DIMENSION_LABELS: Record<string, string> = {
    overall: "Overall Satisfaction",
    quality: "Service Quality",
    communication: "Communication",
    value: "Value for Money",
    reliability: "Reliability",
    assurance: "Assurance",
    tangibles: "Tangibles",
    empathy: "Empathy",
    responsiveness: "Responsiveness",
};

/**
 * Rating dimension descriptions for tooltips/help text
 */
export const RATING_DIMENSION_DESCRIPTIONS: Record<string, string> = {
    overall: "Your overall satisfaction with the service",
    quality: "How would you rate the quality of work performed?",
    communication: "How well did we communicate throughout the service?",
    value: "How would you rate the value for money?",
    reliability: "Did we deliver the service as promised?",
    assurance: "Did our team inspire confidence and trust?",
    tangibles: "How would you rate our professional presentation?",
    empathy: "Did our team show understanding and care?",
    responsiveness: "How quickly did we respond to your needs?",
};

/**
 * Preset rating configurations
 */
export const RATING_CONFIG_PRESETS: Record<RatingConfigType, RatingConfig> = {
    single: {
        type: "single",
        dimensions: ["overall"],
    },
    three_dimensions: {
        type: "three_dimensions",
        dimensions: ["quality", "communication", "value"],
    },
    rater: {
        type: "rater",
        dimensions: [
            "reliability",
            "assurance",
            "tangibles",
            "empathy",
            "responsiveness",
        ],
    },
};

/**
 * Get rating configuration preset by type
 */
export function getRatingConfigPreset(type: RatingConfigType): RatingConfig {
    return RATING_CONFIG_PRESETS[type];
}

/**
 * Get label for a rating dimension
 */
export function getRatingDimensionLabel(dimension: string): string {
    return RATING_DIMENSION_LABELS[dimension] || dimension;
}

/**
 * Get description for a rating dimension
 */
export function getRatingDimensionDescription(dimension: string): string {
    return RATING_DIMENSION_DESCRIPTIONS[dimension] || "";
}
