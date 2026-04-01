/**
 * Currency conversion utilities.
 * Baseline reporting currency: EUR
 * Supported input currencies: EUR, GBP
 * Conversion uses monthly rates from currency_conversion_rates table.
 */

import { supabase } from "@/integrations/supabase/client";

export const CURRENCIES = ["EUR", "GBP", "RON"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  GBP: "£",
  RON: "lei",
};

/** Cache for conversion rates: key = "YYYY-M" */
let rateCache: Record<string, number> = {};
let rateCacheLoaded = false;

/**
 * Load all GBP→EUR conversion rates into cache.
 * Call once at app/page level.
 */
export async function loadConversionRates(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("currency_conversion_rates")
    .select("year, month, rate")
    .eq("from_currency", "GBP")
    .eq("to_currency", "EUR");

  if (error) {
    console.error("Failed to load conversion rates:", error);
    return rateCache;
  }

  rateCache = {};
  data?.forEach((r) => {
    rateCache[`${r.year}-${r.month}`] = Number(r.rate);
  });
  rateCacheLoaded = true;
  return rateCache;
}

/**
 * Get the GBP→EUR rate for a specific month.
 * Falls back to 1.15 if not found.
 */
export function getGbpToEurRate(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
  return rateCache[key] ?? 1.15;
}

/**
 * Convert an amount to EUR using the entry-date month's rate.
 * If already EUR, returns as-is.
 * GBP amounts are multiplied by the GBP→EUR rate for that month.
 */
export function toEur(
  amount: number,
  currency: Currency | string,
  entryDate: string | Date
): number {
  if (!amount) return 0;
  if (currency === "EUR") return amount;
  if (currency === "GBP") {
    return amount * getGbpToEurRate(entryDate);
  }
  // Unknown currency — treat as EUR (legacy fallback)
  return amount;
}

/**
 * Format a number as EUR.
 */
export function fmtEur(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function fmtEurFull(n: number): string {
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Format with the appropriate currency symbol.
 */
export function fmtCurrency(n: number | null | undefined, currency: Currency | string = "EUR"): string {
  if (n == null || isNaN(n)) return "—";
  const sym = CURRENCY_SYMBOLS[currency as Currency] || "€";
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Check if rates are loaded.
 */
export function areRatesLoaded(): boolean {
  return rateCacheLoaded;
}
