/**
 * Detects which forex trading session a trade was opened in based on UTC time.
 * TradeCore uses four sessions aligned to the African trading day:
 *   Asian   00:00–07:00 UTC
 *   London  07:00–13:00 UTC
 *   New York 13:00–20:00 UTC
 *   African 20:00–00:00 UTC
 */

export type ForexSession = "asian" | "london" | "newyork" | "african";

export function detectSession(utcDate: Date): ForexSession {
  const hour = utcDate.getUTCHours();
  if (hour < 7)  return "asian";
  if (hour < 13) return "london";
  if (hour < 20) return "newyork";
  return "african";
}

/** Normalise legacy session values stored in the DB to the four canonical keys. */
export function normaliseSession(raw: string | null | undefined): ForexSession {
  if (!raw) return "asian";
  if (raw === "tokyo" || raw === "sydney") return "asian";
  if (raw === "new_york" || raw === "overlap_london_ny") return "newyork";
  if (raw === "london")  return "london";
  if (raw === "african") return "african";
  if (raw === "asian" || raw === "newyork") return raw as ForexSession;
  return "asian";
}

export function getSessionLabel(session: ForexSession | string): string {
  const labels: Record<string, string> = {
    asian:   "Asian",
    london:  "London",
    newyork: "New York",
    african: "African",
  };
  return labels[session] ?? "Asian";
}

export function getSessionUTCRange(session: ForexSession): string {
  const ranges: Record<ForexSession, string> = {
    asian:   "00:00–07:00 UTC",
    london:  "07:00–13:00 UTC",
    newyork: "13:00–20:00 UTC",
    african: "20:00–00:00 UTC",
  };
  return ranges[session];
}
