/**
 * Currency utilities for TradeCore.
 * Supports four primary African forex markets plus major quote currencies.
 * Exchange rates are fetched from Frankfurter (https://api.frankfurter.app),
 * cached in localStorage for 1 hour, with hard-coded fallback rates so the
 * app never breaks when the API is unavailable.
 */

export const SUPPORTED_CURRENCIES = [
  "USD", "NGN", "GHS", "KES", "ZAR", "GBP", "EUR",
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/** Backward-compat alias used by existing imports. */
export type AfricanCurrency = SupportedCurrency;

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$",
  NGN: "₦",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  GBP: "£",
  EUR: "€",
};

const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
  USD: "en-US",
  NGN: "en-NG",
  GHS: "en-GH",
  KES: "sw-KE",
  ZAR: "en-ZA",
  GBP: "en-GB",
  EUR: "de-DE",
};

/** Approximate fallback rates (USD → target) used when Frankfurter is unreachable. */
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  NGN: 1600,
  GHS: 15,
  KES: 130,
  ZAR: 18,
  GBP: 0.79,
  EUR: 0.92,
};

export const AFRICAN_CURRENCIES: SupportedCurrency[] = ["NGN", "GHS", "KES", "ZAR"];
export const ALL_CURRENCIES = SUPPORTED_CURRENCIES;

/** Kept for backward compat with any code that imported CurrencyConfig. */
export interface CurrencyConfig {
  symbol: string;
  name: string;
  locale: string;
  flag: string;
}

const CACHE_KEY = "tc_fx_rates";
const CACHE_TTL = 3_600_000; // 1 hour

/** Module-level rate cache — starts as fallback, updated by fetchRates(). */
let _rates: Record<string, number> = { ...FALLBACK_RATES };

/**
 * Fetch USD → all currency rates from Frankfurter.
 * Returns cached localStorage value if less than 1 hour old.
 * Falls back to FALLBACK_RATES on any network or parse error.
 */
export async function fetchRates(): Promise<Record<string, number>> {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { rates, ts } = JSON.parse(raw) as { rates: Record<string, number>; ts: number };
        if (Date.now() - ts < CACHE_TTL) {
          _rates = rates;
          return rates;
        }
      }
    } catch {
      // malformed cache entry — fall through to fetch
    }
  }

  try {
    console.time("[currency] fetchRates network");
    const res = await fetch("https://api.frankfurter.app/latest?from=USD");
    console.timeEnd("[currency] fetchRates network");
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const json = (await res.json()) as { rates: Record<string, number> };
    const rates: Record<string, number> = { USD: 1, ...json.rates };
    _rates = rates;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
      } catch {
        // localStorage full — ignore
      }
    }
    return rates;
  } catch {
    _rates = { ...FALLBACK_RATES };
    return _rates;
  }
}

/**
 * Convert a USD amount to the target currency using the cached rates.
 * Returns the original amount unchanged when targetCurrency is USD.
 */
export function convertFromUSD(amountUSD: number, targetCurrency: SupportedCurrency): number {
  if (targetCurrency === "USD") return amountUSD;
  const rate = _rates[targetCurrency] ?? FALLBACK_RATES[targetCurrency] ?? 1;
  return Math.round(amountUSD * rate * 100) / 100;
}

/**
 * Convert amountUSD to targetCurrency, then format with the correct symbol
 * and locale-aware number formatting via Intl.NumberFormat.
 */
export function formatCurrency(amountUSD: number, targetCurrency: SupportedCurrency): string {
  const converted = convertFromUSD(amountUSD, targetCurrency);
  const locale = CURRENCY_LOCALES[targetCurrency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: targetCurrency,
      maximumFractionDigits: 2,
    }).format(converted);
  } catch {
    const symbol = CURRENCY_SYMBOLS[targetCurrency] ?? "$";
    const abs = Math.abs(converted).toFixed(2);
    return `${converted < 0 ? "-" : ""}${symbol}${abs}`;
  }
}

/** Format a pip value with optional sign prefix. */
export function formatPips(pips: number): string {
  const sign = pips > 0 ? "+" : "";
  return `${sign}${pips.toFixed(1)}p`;
}

/** Format a risk-to-reward ratio as "1:2.50". */
export function formatRR(rr: number): string {
  return `1:${rr.toFixed(2)}`;
}

/** Format a percentage with one decimal place and leading sign. */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
