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
    .select("year, month, rate, from_currency")
    .eq("to_currency", "EUR");

  if (error) {
    console.error("Failed to load conversion rates:", error);
    return rateCache;
  }

  rateCache = {};
  data?.forEach((r) => {
    rateCache[`${r.from_currency}-${r.year}-${r.month}`] = Number(r.rate);
  });
  rateCacheLoaded = true;
  return rateCache;
}

/**
 * Get the GBP→EUR rate for a specific month.
 * Falls back to 1.15 if not found.
 */
export function getToEurRate(currency: string, date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const key = `${currency}-${d.getFullYear()}-${d.getMonth() + 1}`;
  if (rateCache[key] != null) return rateCache[key];
  // fallback defaults
  if (currency === "GBP") return 1.15;
  if (currency === "RON") return 0.20;
  return 1;
}

/** @deprecated use getToEurRate */
export function getGbpToEurRate(date: string | Date): number {
  return getToEurRate("GBP", date);
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
  if (currency === "GBP" || currency === "RON") {
    return amount * getToEurRate(currency, entryDate);
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

/**
 * Check which currencies are missing rates for a given month.
 * Returns array of currency codes that have no rate to EUR for that month.
 */
export function getMissingRates(currencies: string[], year: number, month: number): string[] {
  return currencies
    .filter((c) => c !== "EUR")
    .filter((c) => rateCache[`${c}-${year}-${month}`] == null);
}
