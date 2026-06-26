/**
 * MT4 / MT5 CSV history parser for TradeCore.
 * Runs in the browser (client-side) — no server roundtrip needed for parsing.
 *
 * Uses:
 *  - PapaParse  for robust CSV parsing (handles quoted fields, varied delimiters)
 *  - date-fns   for multi-format date parsing
 *  - detectSession from lib/session-detector for session tagging
 */

import Papa from "papaparse";
import { parse as dfParse, isValid } from "date-fns";
import { detectSession } from "@/lib/session-detector";

/* ═══════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════ */

export interface ParsedTrade {
  symbol: string;
  direction: "long" | "short";
  entry_price: string;
  exit_price: string | null;
  size_lots: string;
  pnl_usd: string | null;
  commission: string | null;
  swap: string | null;
  stop_loss: string | null;
  take_profit: string | null;
  setup_tag: string | null;
  broker_trade_id: string | null;
  entry_at: Date;
  exit_at: Date | null;
  session: string;
  source: "csv";
}

export interface ParseResult {
  trades: ParsedTrade[];
  failed_rows: number;
  skipped_non_trades: number;
  date_range: { earliest: Date | null; latest: Date | null };
}

/* ═══════════════════════════════════════════════════════════════
   Column map — every known broker header alias → internal field
═══════════════════════════════════════════════════════════════ */

type InternalField =
  | "entry_at"
  | "exit_at"
  | "symbol"
  | "direction"
  | "size_lots"
  | "entry_price"
  | "exit_price"
  | "pnl_usd"
  | "broker_trade_id"
  | "stop_loss"
  | "take_profit"
  | "commission"
  | "swap"
  | "setup_tag";

const COLUMN_MAP: Record<string, InternalField> = {};

function registerAliases(field: InternalField, aliases: string[]) {
  for (const alias of aliases) {
    COLUMN_MAP[alias.toLowerCase().trim()] = field;
  }
}

registerAliases("entry_at", [
  "Time", "Open Time", "Entry Time", "Open", "Date/Time",
  "Opened", "Date", "Open Date", "OpenTime", "Entry",
  "Open time", "Time (open)", "Open Date/Time",
]);
registerAliases("exit_at", [
  "Close Time", "Exit Time", "Closed", "Close Date",
  "CloseTime", "Exit", "Close time", "Time (close)", "Close Date/Time",
]);
registerAliases("symbol", [
  "Symbol", "Instrument", "Asset", "Currency Pair",
  "Pair", "Market", "Item", "Product",
]);
registerAliases("direction", [
  "Type", "Direction", "Action", "Side",
  "Operation", "Trade Type", "Order Type", "Cmd",
]);
registerAliases("size_lots", [
  "Volume", "Lots", "Size", "Qty", "Quantity",
  "Units", "Amount", "Lot", "Lot Size",
]);
registerAliases("entry_price", [
  "Price", "Open Price", "Entry Price", "Open",
  "Rate", "Entry Rate", "OpenPrice", "Open price",
]);
registerAliases("exit_price", [
  "Close Price", "Exit Price", "Close", "Close Rate",
  "Exit Rate", "ClosePrice", "Close price",
]);
registerAliases("pnl_usd", [
  "Profit", "P&L", "Net Profit", "Gain", "Net P&L",
  "Pnl", "Profit/Loss", "Realized P&L", "Gross Profit",
  "Net profit", "Profit ($)", "P/L",
]);
registerAliases("broker_trade_id", [
  "Ticket", "Order", "Deal", "ID", "Transaction",
  "Order #", "Position", "Trade #", "Order ID",
  "Position ID", "Ticket #",
]);
registerAliases("stop_loss", [
  "S / L", "Stop Loss", "SL", "Stop", "StopLoss",
  "Stop loss", "S/L",
]);
registerAliases("take_profit", [
  "T / P", "Take Profit", "TP", "Target", "TakeProfit",
  "Take profit", "T/P",
]);
registerAliases("commission", [
  "Commission", "Comm", "Fee", "Fees", "Commissions",
]);
registerAliases("swap", [
  "Swap", "Rollover", "Overnight", "Swap fee",
]);
registerAliases("setup_tag", [
  "Comment", "Notes", "Description", "Label",
  "Magic", "Note", "Memo", "Tag",
]);

/* ═══════════════════════════════════════════════════════════════
   Date parsing — tries multiple formats used by different brokers
═══════════════════════════════════════════════════════════════ */

const DATE_FORMATS = [
  "yyyy.MM.dd HH:mm:ss",
  "yyyy-MM-dd HH:mm:ss",
  "MM/dd/yyyy HH:mm",
  "dd.MM.yyyy HH:mm",
  "yyyy.MM.dd HH:mm",
  "dd/MM/yyyy HH:mm:ss",
  "MM-dd-yyyy HH:mm:ss",
  "yyyy/MM/dd HH:mm:ss",
  "dd-MM-yyyy HH:mm:ss",
  "yyyy.MM.dd",
  "yyyy-MM-dd",
  "dd.MM.yyyy",
  "MM/dd/yyyy",
];

export function parseDate(value: string): Date | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();

  // First try native ISO parse (catches yyyy-MM-ddTHH:mm:ssZ etc.)
  const native = new Date(v);
  if (!isNaN(native.getTime()) && v.includes("T")) return native;

  // Try each format with a reference date for ambiguous ones
  const ref = new Date(2000, 0, 1);
  for (const fmt of DATE_FORMATS) {
    try {
      const parsed = dfParse(v, fmt, ref);
      if (isValid(parsed) && parsed.getFullYear() > 1990) return parsed;
    } catch {
      // Try next format
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Direction normalisation
═══════════════════════════════════════════════════════════════ */

const LONG_VALUES = new Set([
  "buy", "long", "b", "bl", "buy limit", "buy stop",
  "buy_limit", "buy_stop", "buylimit", "buystop",
  "buy stop limit", "0",
]);
const SHORT_VALUES = new Set([
  "sell", "short", "s", "sl", "sell limit", "sell stop",
  "sell_limit", "sell_stop", "selllimit", "sellstop",
  "sell stop limit", "1",
]);

export function normaliseDirection(value: string): "long" | "short" | null {
  const v = value.toLowerCase().trim();
  if (LONG_VALUES.has(v))  return "long";
  if (SHORT_VALUES.has(v)) return "short";
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Non-trade row detection (deposits, corrections, etc.)
═══════════════════════════════════════════════════════════════ */

const NON_TRADE_KEYWORDS = [
  "balance", "deposit", "withdrawal", "withdraw", "credit",
  "correction", "dividend", "interest", "transfer", "bonus",
  "rebate", "commission", "swap only", "adjustment",
  "internal transfer", "external", "cancelled", "rejected",
];

export function isNonTradeRow(row: Record<string, string>): boolean {
  // Check the direction/type field value
  const dirKey = Object.keys(row).find(
    (k) => COLUMN_MAP[k.toLowerCase().trim()] === "direction"
  );
  if (!dirKey) return false;
  const val = (row[dirKey] ?? "").toLowerCase().trim();
  return NON_TRADE_KEYWORDS.some((kw) => val.includes(kw));
}

/* ═══════════════════════════════════════════════════════════════
   Deterministic dedup ID for rows without a broker ticket number
═══════════════════════════════════════════════════════════════ */

function deterministicId(
  symbol: string,
  entry_at: Date,
  direction: string,
  size_lots: string
): string {
  return `csv_${symbol}_${entry_at.toISOString()}_${direction}_${size_lots}`
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 60);
}

/* ═══════════════════════════════════════════════════════════════
   Column header detection — maps raw CSV headers → internal field
═══════════════════════════════════════════════════════════════ */

function buildHeaderMapping(headers: string[]): Map<string, InternalField> {
  const map = new Map<string, InternalField>();
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const field = COLUMN_MAP[normalized];
    if (field && !map.has(field)) {
      map.set(header, field); // key = original header, value = internal field
    }
  }
  return map;
}

function getField(
  row: Record<string, string>,
  headerMapping: Map<string, InternalField>,
  field: InternalField
): string | null {
  for (const [header, internalField] of headerMapping.entries()) {
    if (internalField === field) {
      const val = row[header];
      if (val !== undefined && val.trim() !== "") return val.trim();
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Main export — parseMT5CSV
═══════════════════════════════════════════════════════════════ */

export function parseMT5CSV(csvContent: string): ParseResult {
  const result: ParseResult = {
    trades: [],
    failed_rows: 0,
    skipped_non_trades: 0,
    date_range: { earliest: null, latest: null },
  };

  // 1. Parse with PapaParse — header:true gives objects keyed by header name
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) return result;

  // 2. Detect column mapping from first row's keys
  const headers = Object.keys(parsed.data[0] ?? {});
  const headerMapping = buildHeaderMapping(headers);

  // 3. Process each row
  for (const row of parsed.data) {
    // Skip non-trade rows (balance, deposit, etc.)
    if (isNonTradeRow(row)) {
      result.skipped_non_trades++;
      continue;
    }

    // Parse direction — required
    const rawDirection = getField(row, headerMapping, "direction");
    if (!rawDirection) { result.failed_rows++; continue; }
    const direction = normaliseDirection(rawDirection);
    if (!direction) { result.failed_rows++; continue; }

    // Parse entry_at — required
    const rawEntryAt = getField(row, headerMapping, "entry_at");
    if (!rawEntryAt) { result.failed_rows++; continue; }
    const entry_at = parseDate(rawEntryAt);
    if (!entry_at) { result.failed_rows++; continue; }

    // Optional fields
    const rawExitAt  = getField(row, headerMapping, "exit_at");
    const exit_at    = rawExitAt ? parseDate(rawExitAt) : null;

    const rawSymbol  = getField(row, headerMapping, "symbol") ?? "";
    const symbol     = rawSymbol.toUpperCase().replace(/\s/g, "");
    if (!symbol) { result.failed_rows++; continue; }

    const rawSize    = getField(row, headerMapping, "size_lots") ?? "0";
    const size_lots  = rawSize.replace(/[^0-9.]/g, "") || "0";

    const rawEntry   = getField(row, headerMapping, "entry_price") ?? "0";
    const entry_price = rawEntry.replace(/[^0-9.]/g, "") || "0";

    const rawExit   = getField(row, headerMapping, "exit_price");
    const exit_price = rawExit ? (rawExit.replace(/[^0-9.-]/g, "") || null) : null;

    const rawPnl    = getField(row, headerMapping, "pnl_usd");
    const pnl_usd   = rawPnl ? (rawPnl.replace(/[^0-9.,-]/g, "").replace(",", ".") || null) : null;

    const rawComm   = getField(row, headerMapping, "commission");
    const commission = rawComm ? (rawComm.replace(/[^0-9.,-]/g, "").replace(",", ".") || null) : null;

    const rawSwap   = getField(row, headerMapping, "swap");
    const swap      = rawSwap ? (rawSwap.replace(/[^0-9.,-]/g, "").replace(",", ".") || null) : null;

    const rawSL     = getField(row, headerMapping, "stop_loss");
    const stop_loss = rawSL ? (rawSL.replace(/[^0-9.]/g, "") || null) : null;

    const rawTP     = getField(row, headerMapping, "take_profit");
    const take_profit = rawTP ? (rawTP.replace(/[^0-9.]/g, "") || null) : null;

    const setup_tag = getField(row, headerMapping, "setup_tag") || null;

    const rawId     = getField(row, headerMapping, "broker_trade_id");
    const broker_trade_id = rawId
      ? rawId.trim()
      : deterministicId(symbol, entry_at, direction, size_lots);

    const session = detectSession(entry_at);

    const trade: ParsedTrade = {
      symbol,
      direction,
      entry_price,
      exit_price: exit_price && exit_price !== "0" ? exit_price : null,
      size_lots,
      pnl_usd,
      commission,
      swap,
      stop_loss: stop_loss && stop_loss !== "0" ? stop_loss : null,
      take_profit: take_profit && take_profit !== "0" ? take_profit : null,
      setup_tag,
      broker_trade_id,
      entry_at,
      exit_at,
      session,
      source: "csv",
    };

    result.trades.push(trade);

    // Track date range
    if (!result.date_range.earliest || entry_at < result.date_range.earliest) {
      result.date_range.earliest = entry_at;
    }
    if (!result.date_range.latest || entry_at > result.date_range.latest) {
      result.date_range.latest = entry_at;
    }
  }

  return result;
}
