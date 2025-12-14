/**
 * Utility functions for payment-related formatting
 */

/**
 * Format currency amount based on currency code
 */
export function formatCurrency(amount: number, currency: string): string {
    const currencyLocaleMap: Record<string, string> = {
        AUD: "en-AU",
        USD: "en-US",
        GBP: "en-GB",
        EUR: "de-DE",
        CAD: "en-CA",
        NZD: "en-NZ",
    };

    // Default to AUD for unknown currencies
    const normalizedCurrency = currencyLocaleMap[currency] ? currency : "AUD";
    const locale = currencyLocaleMap[normalizedCurrency] || "en-AU";

    const formatted = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 2,
    }).format(isNaN(amount) ? 0 : amount);

    // Normalize non-breaking spaces to regular spaces
    let normalized = formatted.replace(/\u00A0/g, " ");

    // For AUD, ensure we have the A$ prefix
    if (normalizedCurrency === "AUD" && !normalized.startsWith("A$")) {
        normalized = normalized.replace("$", "A$");
    }

    return normalized;
}

/**
 * Format date for display
 */
export function formatPaymentDate(dateString: string | null): string {
    if (!dateString) return "-";
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString("en-AU", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return dateString;
    }
}
