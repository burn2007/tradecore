"use client";

import { useRouter } from "next/navigation";
import { useCurrency } from "@/hooks/useCurrency";

export interface TradeRowData {
  id: string;
  symbol: string;
  direction: string;
  pnlUsd: string | null;
  entryAt: string;
  exitAt?: string | null;
  setupTag?: string | null;
  session?: string | null;
  source?: string;
  violationCount?: number;
  hasEmotionLog?: boolean;
}

interface Props {
  trade: TradeRowData;
  /** Disables click-through navigation and hover affordance — for read-only contexts like the admin panel. */
  readOnly?: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(entry: string, exit?: string | null) {
  if (!exit) return null;
  const ms = new Date(exit).getTime() - new Date(entry).getTime();
  if (ms < 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  manual: { bg: "#0A1220", color: "#4B6080" },
  csv:    { bg: "#0D1F20", color: "#50E3B8" },
  mt4:    { bg: "#1A1220", color: "#C9B890" },
  mt5:    { bg: "#1A1220", color: "#C9B890" },
};

const ROW: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 8,
  marginBottom: 6,
  overflow: "hidden",
  transition: "border-color 0.15s",
};

const PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  borderRadius: 5,
  backgroundColor: "#0A1220",
  color: "#4B6080",
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: "0.04em",
  border: "1px solid #1A2640",
};

/** The one trade row component in the app — used by the journal list and (read-only) the admin panel. */
export default function TradeRow({ trade, readOnly = false }: Props) {
  const router          = useRouter();
  const { formatPnl }   = useCurrency();
  const pnl             = trade.pnlUsd != null ? parseFloat(trade.pnlUsd) : null;
  const stripeColor = pnl === null ? "#E2B96F" : pnl >= 0 ? "#50E3B8" : "#F07C7C";
  const pnlColor    = pnl === null ? "#6B8AAA" : pnl >= 0 ? "#50E3B8" : "#F07C7C";
  const duration    = fmtDuration(trade.entryAt, trade.exitAt);
  const src         = trade.source?.toLowerCase();
  const srcStyle    = src ? (SOURCE_COLORS[src] ?? SOURCE_COLORS.manual) : null;

  return (
    <div
      onClick={readOnly ? undefined : () => router.push(`/journal/${trade.id}`)}
      onMouseEnter={readOnly ? undefined : (e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#2A3A54"; }}
      onMouseLeave={readOnly ? undefined : (e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1A2640"; }}
      style={{ ...ROW, display: "flex", alignItems: "stretch", cursor: readOnly ? "default" : "pointer" }}
    >
      {/* Colour stripe */}
      <div style={{ width: 3, backgroundColor: stripeColor, flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#B0A898" }}>{trade.symbol}</span>
            <span style={{
              ...PILL,
              backgroundColor: trade.direction === "long" ? "#0D2420" : "#240808",
              color:           trade.direction === "long" ? "#50E3B8" : "#F07C7C",
              border: `1px solid ${trade.direction === "long" ? "#50E3B8" : "#F07C7C"}`,
            }}>
              {trade.direction === "long" ? "Long" : "Short"}
            </span>
            {trade.session && (
              <span style={{ ...PILL, textTransform: "capitalize" }}>{trade.session}</span>
            )}
            {trade.setupTag && (
              <span style={PILL}>{trade.setupTag}</span>
            )}
          </div>

          {/* Row 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#2E4060" }}>{fmtDate(trade.entryAt)}</span>
            {duration && <span style={{ fontSize: 9, color: "#2E4060" }}>· {duration}</span>}
            {srcStyle && trade.source && (
              <span style={{
                ...PILL, fontSize: 9,
                backgroundColor: srcStyle.bg,
                color: srcStyle.color,
                borderColor: "#1A2640",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>{trade.source}</span>
            )}
          </div>
        </div>

        {/* Right: P&L + compliance */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: pnlColor, margin: "0 0 4px" }}>
            {pnl === null ? "—" : pnl >= 0 ? `+${formatPnl(pnl)}` : formatPnl(pnl)}
          </p>
          {trade.violationCount != null && trade.violationCount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#F07C7C" }} />
              <span style={{ fontSize: 9, color: "#F07C7C" }}>{trade.violationCount} rule{trade.violationCount !== 1 ? "s" : ""} broken</span>
            </div>
          ) : trade.hasEmotionLog ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#50E3B8" }} />
              <span style={{ fontSize: 9, color: "#50E3B8" }}>Rules ✓</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
