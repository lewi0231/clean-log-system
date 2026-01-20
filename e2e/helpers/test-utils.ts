/**
 * Common test utilities for E2E tests
 */

import { Page } from "@playwright/test";

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format currency amount for display comparison
 */
export function formatCurrency(amount: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Extract numeric value from currency string
 */
export function parseCurrency(currencyString: string): number {
  const cleaned = currencyString.replace(/[^0-9.-]+/g, "");
  return parseFloat(cleaned);
}

/**
 * Generate a unique test identifier
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Take a debug screenshot
 */
export async function debugScreenshot(
  page: Page,
  name: string
): Promise<string> {
  const path = `./test-results/debug-${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout = 5000
): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout });
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await wait(delayMs * attempt);
      }
    }
  }

  throw lastError;
}

/**
 * Check if element exists without throwing
 */
export async function elementExists(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  return (await element.count()) > 0;
}

/**
 * Get text content of element, or null if not found
 */
export async function getTextContent(
  page: Page,
  selector: string
): Promise<string | null> {
  const element = page.locator(selector);
  if ((await element.count()) === 0) {
    return null;
  }
  return element.first().textContent();
}

/**
 * Safe click - waits for element and handles potential overlays
 */
export async function safeClick(
  page: Page,
  selector: string,
  options?: { timeout?: number }
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: "visible", timeout: options?.timeout ?? 5000 });
  await element.click();
}

/**
 * Fill form field with validation
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: "visible" });
  await element.fill(value);

  // Verify value was set
  const actualValue = await element.inputValue();
  if (actualValue !== value) {
    console.warn(
      `Field value mismatch: expected "${value}", got "${actualValue}"`
    );
  }
}

/**
 * Select option in dropdown by text
 */
export async function selectOption(
  page: Page,
  selector: string,
  optionText: string
): Promise<void> {
  const select = page.locator(selector);
  await select.waitFor({ state: "visible" });

  // Try to find option by text
  const option = select.locator(`option:has-text("${optionText}")`);
  if ((await option.count()) > 0) {
    const value = await option.getAttribute("value");
    if (value) {
      await select.selectOption(value);
      return;
    }
  }

  // Fallback to clicking the select and option
  await select.click();
  await page.click(`text="${optionText}"`);
}

/**
 * Assert table row count
 */
export async function assertTableRowCount(
  page: Page,
  tableSelector: string,
  expectedCount: number
): Promise<void> {
  const rows = page.locator(`${tableSelector} tbody tr`);
  const count = await rows.count();

  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} table rows, but found ${count}`
    );
  }
}

/**
 * Get all table data as array of objects
 */
export async function getTableData(
  page: Page,
  tableSelector: string
): Promise<Record<string, string>[]> {
  const table = page.locator(tableSelector);
  const headers = await table.locator("thead th").allTextContents();
  const rows = await table.locator("tbody tr").all();

  const data: Record<string, string>[] = [];

  for (const row of rows) {
    const cells = await row.locator("td").allTextContents();
    const rowData: Record<string, string> = {};

    headers.forEach((header, index) => {
      rowData[header.trim().toLowerCase().replace(/\s+/g, "_")] =
        cells[index]?.trim() ?? "";
    });

    data.push(rowData);
  }

  return data;
}
