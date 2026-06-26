/**
 * Currency utilities for TradeCore.
 * Supports the four primary African forex markets plus the three
 * major quote currencies used in forex pairs.
 */

export type AfricanCurrency = "NGN" | "GHS" | "KES" | "ZAR" | "USD" | "EUR" | "GBP";

export interface CurrencyConfig {
  symbol: string;
  name: string;
  locale: string;
  flag: string;
}

export const CURRENCY_CONFIG: Record<AfricanCurrency, CurrencyConfig> = {
  NGN: { symbol: "₦", name: "Nigerian Naira",       locale: "en-NG", flag: "🇳🇬" },
  GHS: { symbol: "₵", name: "Ghanaian Cedi",        locale: "en-GH", flag: "🇬🇭" },
  KES: { symbol: "KSh", name: "Kenyan Shilling",    locale: "sw-KE", flag: "🇰🇪" },
  ZAR: { symbol: "R",  name: "South African Rand",  locale: "en-ZA", flag: "🇿🇦" },
  USD: { symbol: "$",  name: "US Dollar",            locale: "en-US", flag: "🇺🇸" },
  EUR: { symbol: "€",  name: "Euro",                 locale: "de-DE", flag: "🇪🇺" },
  GBP: { symbol: "£",  name: "British Pound",        locale: "en-GB", flag: "🇬🇧" },
};

export const AFRICAN_CURRENCIES: AfricanCurrency[] = ["NGN", "GHS", "KES", "ZAR"];
export const ALL_CURRENCIES = Object.keys(CURRENCY_CONFIG) as AfricanCurrency[];

/**
 * Format a monetary amount in the given currency using the browser/Node Intl API.
 * Falls back to a manual symbol-prefix if the locale is unsupported.
 */
export function formatCurrency(
  amount: number,
  currency: AfricanCurrency,
  options: { compact?: boolean; showSign?: boolean } = {}
): string {
  const config = CURRENCY_CONFIG[currency];
  const sign = options.showSign && amount > 0 ? "+" : "";

  try {
    const formatted = new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency,
      notation: options.compact ? "compact" : "standard",
      maximumFractionDigits: 2,
    }).format(amount);

    return options.showSign && amount > 0 ? `+${formatted}` : formatted;
  } catch {
    // Fallback for environments where the currency/locale pair isn't supported
    const abs = Math.abs(amount).toFixed(2);
    const prefix = amount < 0 ? "-" : sign;
    return `${prefix}${config.symbol}${abs}`;
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

/** Format a percentage with one decimal place. */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
