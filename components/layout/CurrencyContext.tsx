"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  fetchRates,
  formatCurrency,
  convertFromUSD,
  CURRENCY_SYMBOLS,
  type SupportedCurrency,
} from "@/lib/currency";

interface CurrencyCtx {
  currency: SupportedCurrency;
  symbol: string;
  /** Format a USD amount in the user's preferred currency. Returns "—" for null/NaN. */
  formatPnl: (amountUSD: number | string | null | undefined) => string;
  /** Convert a USD amount to the user's preferred currency (numeric, no formatting). */
  convert: (amountUSD: number) => number;
}

const DEFAULT_CTX: CurrencyCtx = {
  currency: "USD",
  symbol: "$",
  formatPnl: (v) => {
    const n = typeof v === "string" ? parseFloat(v) : (v ?? NaN);
    return isNaN(n as number) ? "—" : `$${(n as number).toFixed(2)}`;
  },
  convert: (v) => v,
};

const CurrencyContext = createContext<CurrencyCtx>(DEFAULT_CTX);

export function CurrencyProvider({
  initialCurrency,
  children,
}: {
  initialCurrency: string;
  children: ReactNode;
}) {
  const [currency, setCurrency] = useState<SupportedCurrency>(
    (initialCurrency || "USD") as SupportedCurrency
  );
  // Bumped when fetchRates() resolves so useMemo re-runs and consumers re-render
  // with accurate rates that are now in the module-level cache inside currency.ts.
  const [rateTick, setRateTick] = useState(0);

  // Sync currency when the server re-renders after a currency preference change.
  useEffect(() => {
    setCurrency((initialCurrency || "USD") as SupportedCurrency);
  }, [initialCurrency]);

  // Fetch live rates once on mount; updates the module-level cache in currency.ts.
  useEffect(() => {
    fetchRates().then(() => setRateTick((t) => t + 1));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo<CurrencyCtx>(() => ({
    currency,
    symbol: CURRENCY_SYMBOLS[currency] ?? "$",
    formatPnl(amountUSD) {
      if (amountUSD === null || amountUSD === undefined) return "—";
      const n = typeof amountUSD === "string" ? parseFloat(amountUSD) : amountUSD;
      if (isNaN(n)) return "—";
      return formatCurrency(n, currency);
    },
    convert(amountUSD: number) {
      return convertFromUSD(amountUSD, currency);
    },
  }), [currency, rateTick]); // rateTick ensures re-render after live rates load

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyCtx {
  return useContext(CurrencyContext);
}
