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

    const locale = currencyLocaleMap[currency] || "en-AU";
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 2,
    }).format(isNaN(amount) ? 0 : amount);
}

/**
 * Format date for display
 */
export function formatPaymentDate(dateString: string | null): string {
    if (!dateString) return "-";
    try {
        return new Date(dateString).toLocaleDateString("en-AU", {
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
