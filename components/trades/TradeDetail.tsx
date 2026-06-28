"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/useCurrency";

/* ── Types ── */
interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: string;
  exitPrice: string | null;
  sizeLots: string;
  pnlUsd: string | null;
  commission: string | null;
  swap: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  setupTag: string | null;
  session: string | null;
  source: string;
  brokerTradeId: string | null;
  isPaperTrade: boolean;
  entryAt: string;
  exitAt: string | null;
  createdAt: string;
}

interface EmotionLog {
  id: string;
  preMood: number | null;
  postMood: number | null;
  preNote: string | null;
  postNote: string | null;
}

interface Violation {
  id: string;
  ruleId: string;
  ruleTitle: string | null;
}

interface Screenshot {
  id: string;
  r2Url: string;
  capturedAt: string;
}

interface TradeDetailData {
  trade: Trade;
  emotionLog: EmotionLog | null;
  violations: Violation[];
  screenshots: Screenshot[];
}

/* ── Helpers ── */

function fmtPrice(v: string | null) {
  if (!v) return "—";
  return parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}
function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}
function fmtDuration(entry: string, exit: string | null) {
  if (!exit) return "Open";
  const ms = new Date(exit).getTime() - new Date(entry).getTime();
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* ── Style constants ── */
const CARD: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 11,
  padding: "14px 16px",
  marginBottom: 12,
};
const LABEL_SM: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#2E4060",
  fontWeight: 500,
  marginBottom: 4,
  display: "block",
};
const INPUT: React.CSSProperties = {
  backgroundColor: "#0A0F1A",
  border: "1px solid #1A2640",
  borderRadius: 8,
  color: "#C9C2AE",
  height: 40,
  padding: "0 12px",
  width: "100%",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

/* ── Mood Display ── */
function MoodDisplay({ value, label }: { value: number | null; label: string }) {
  const MOODS = [
    { v: 1, label: "Anxious",   color: "#F07C7C" },
    { v: 2, label: "Cautious",  color: "#E2B96F" },
    { v: 3, label: "Neutral",   color: "#8BA8C4" },
    { v: 4, label: "Confident", color: "#50E3B8" },
    { v: 5, label: "Euphoric",  color: "#E2B96F" },
  ];
  return (
    <div>
      <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 10px" }}>{label}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        {MOODS.map((m) => {
          const active = value === m.v;
          return (
            <div key={m.v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: `2px solid ${active ? m.color : "#1A2640"}`,
                backgroundColor: active ? `${m.color}18` : "#0A0F1A",
              }} />
              <span style={{ fontSize: 9, color: active ? m.color : "#2E4060", fontWeight: active ? 500 : 400 }}>
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Edit Modal ── */
interface EditModalProps {
  trade: Trade;
  onClose: () => void;
  onSaved: () => void;
}
function EditModal({ trade, onClose, onSaved }: EditModalProps) {
  const [symbol,     setSymbol]     = useState(trade.symbol);
  const [direction,  setDirection]  = useState(trade.direction);
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice ?? "");
  const [exitPrice,  setExitPrice]  = useState(trade.exitPrice ?? "");
  const [sizeLots,   setSizeLots]   = useState(trade.sizeLots ?? "");
  const [pnlUsd,     setPnlUsd]     = useState(trade.pnlUsd ?? "");
  const [setupTag,   setSetupTag]   = useState(trade.setupTag ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol:     symbol.toUpperCase(),
          direction,
          entryPrice: parseFloat(entryPrice) || undefined,
          exitPrice:  exitPrice ? parseFloat(exitPrice) : null,
          sizeLots:   parseFloat(sizeLots) || undefined,
          pnlUsd:     pnlUsd !== "" ? parseFloat(pnlUsd) : null,
          setupTag:   setupTag || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed"); return; }
      onSaved();
    } catch { setError("Network error. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backgroundColor: "rgba(10,15,26,0.85)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "#111C2E", border: "1px solid #1A2640",
        borderRadius: "11px 11px 0 0", width: "100%", maxWidth: 520,
        padding: "20px 16px 32px", maxHeight: "90vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#C9C2AE", margin: "0 0 16px" }}>Edit trade</p>

        <label style={LABEL_SM}>Symbol</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} style={{ ...INPUT, marginBottom: 12 }} />

        <label style={LABEL_SM}>Direction</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["long", "short"] as const).map((d) => {
            const sel = direction === d, isLong = d === "long";
            return (
              <button key={d} type="button" onClick={() => setDirection(d)} style={{
                flex: 1, height: 40, borderRadius: 8, fontSize: 13, fontWeight: sel ? 500 : 400,
                cursor: "pointer", fontFamily: "inherit",
                backgroundColor: sel ? (isLong ? "#0D2420" : "#240808") : "#0A0F1A",
                border: `1px solid ${sel ? (isLong ? "#50E3B8" : "#F07C7C") : "#1A2640"}`,
                color: sel ? (isLong ? "#50E3B8" : "#F07C7C") : "#4B6080",
              }}>{isLong ? "Long" : "Short"}</button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LABEL_SM}>Entry price</label>
            <input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} step="any" style={INPUT} />
          </div>
          <div>
            <label style={LABEL_SM}>Size (lots)</label>
            <input type="number" value={sizeLots} onChange={(e) => setSizeLots(e.target.value)} step="0.01" style={INPUT} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LABEL_SM}>Exit price <span style={{ color: "#1A2640", textTransform: "none", fontSize: 9 }}>optional</span></label>
            <input type="number" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} step="any" style={INPUT} />
          </div>
          <div>
            <label style={LABEL_SM}>P&L ($)</label>
            <input type="number" value={pnlUsd} onChange={(e) => setPnlUsd(e.target.value)} step="0.01" style={INPUT} />
          </div>
        </div>

        <label style={LABEL_SM}>Setup tag</label>
        <input value={setupTag} onChange={(e) => setSetupTag(e.target.value)}
          placeholder="e.g. London breakout" style={{ ...INPUT, marginBottom: 16 }} />

        {error && <p style={{ color: "#F07C7C", fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, height: 44, borderRadius: 8, backgroundColor: "#0A0F1A",
            border: "1px solid #1A2640", color: "#6B8AAA", fontSize: 13,
            fontFamily: "inherit", cursor: "pointer",
          }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            flex: 2, height: 44, borderRadius: 8, backgroundColor: "#E2B96F",
            border: "none", color: "#0A0F1A", fontSize: 13, fontWeight: 500,
            fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm ── */
function DeleteConfirm({ tradeId, onClose, onDeleted }: { tradeId: string; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState("");

  async function handleDelete() {
    setDeleting(true); setError("");
    try {
      const res = await fetch(`/api/trades/${tradeId}`, { method: "DELETE" });
      if (!res.ok) { setError("Delete failed. Please try again."); return; }
      onDeleted();
    } catch { setError("Network error."); }
    finally { setDeleting(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backgroundColor: "rgba(10,15,26,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "#111C2E", border: "1px solid #F07C7C",
        borderRadius: 11, padding: "20px 16px", width: "100%", maxWidth: 400,
      }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#F07C7C", margin: "0 0 8px" }}>Delete this trade?</p>
        <p style={{ fontSize: 12, color: "#6B8AAA", margin: "0 0 20px" }}>
          This cannot be undone. All related emotion logs, rule violations, and screenshots will also be deleted.
        </p>
        {error && <p style={{ color: "#F07C7C", fontSize: 12, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, height: 40, borderRadius: 8, backgroundColor: "#0A0F1A",
            border: "1px solid #1A2640", color: "#6B8AAA", fontSize: 13,
            fontFamily: "inherit", cursor: "pointer",
          }}>Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} style={{
            flex: 1, height: 40, borderRadius: 8, backgroundColor: "#240808",
            border: "1px solid #F07C7C", color: "#F07C7C", fontSize: 13, fontWeight: 500,
            fontFamily: "inherit", cursor: deleting ? "not-allowed" : "pointer",
            opacity: deleting ? 0.7 : 1,
          }}>{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function TradeDetail({ id, userId }: { id: string; userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEdit,   setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading, isError } = useQuery<TradeDetailData>({
    queryKey: ["trade", userId, id],
    queryFn: async () => {
      const res = await fetch(`/api/trades/${id}`);
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error("fetch-failed");
      return res.json();
    },
  });

  if (isLoading) return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: 40, textAlign: "center", color: "#4B6080", fontSize: 13 }}>
      Loading trade…
    </div>
  );

  if (isError || !data?.trade) return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <Link href="/journal" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4B6080", fontSize: 12, textDecoration: "none", marginBottom: 16 }}>
        ← Journal
      </Link>
      <div style={{ ...CARD, borderLeft: "3px solid #F07C7C" }}>
        <p style={{ color: "#F07C7C", fontSize: 13, margin: 0 }}>Trade not found or you don&apos;t have access.</p>
      </div>
    </div>
  );

  const { formatPnl } = useCurrency();
  const { trade, emotionLog, violations, screenshots } = data;
  const pnl = trade.pnlUsd != null ? parseFloat(trade.pnlUsd) : null;
  const pnlColor = pnl === null ? "#6B8AAA" : pnl >= 0 ? "#50E3B8" : "#F07C7C";

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ["trade", userId, id] });
    queryClient.invalidateQueries({ queryKey: ["trades", userId] });
    setShowEdit(false);
  }
  function handleDeleted() {
    queryClient.invalidateQueries({ queryKey: ["trades", userId] });
    router.push("/journal");
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 60 }}>

      {/* ── Back button ── */}
      <Link href="/journal" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        color: "#4B6080", fontSize: 12, textDecoration: "none", marginBottom: 14,
      }}>← Journal</Link>

      {/* ── Trade header card ── */}
      <div style={{ ...CARD, borderTop: `3px solid ${pnlColor}` }}>
        {/* Symbol + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 500, color: "#C9C2AE" }}>{trade.symbol}</span>
          <span style={{
            fontSize: 11, fontWeight: 500, borderRadius: 5, padding: "2px 8px",
            color: trade.direction === "long" ? "#50E3B8" : "#F07C7C",
            backgroundColor: trade.direction === "long" ? "#0D2420" : "#240808",
            border: `1px solid ${trade.direction === "long" ? "#50E3B8" : "#F07C7C"}`,
          }}>{trade.direction === "long" ? "Long" : "Short"}</span>
          {trade.session && (
            <span style={{
              fontSize: 9, borderRadius: 5, padding: "2px 7px",
              backgroundColor: "#0A1220", color: "#4B6080",
              border: "1px solid #1A2640", textTransform: "capitalize",
            }}>{trade.session}</span>
          )}
          {trade.setupTag && (
            <span style={{
              fontSize: 9, borderRadius: 5, padding: "2px 7px",
              backgroundColor: "#0A1220", color: "#4B6080", border: "1px solid #1A2640",
            }}>{trade.setupTag}</span>
          )}
        </div>

        {/* P&L */}
        <p style={{ fontSize: 24, fontWeight: 500, color: pnlColor, margin: "0 0 16px" }}>
          {pnl === null ? "Open trade" : pnl >= 0 ? `+${formatPnl(pnl)}` : formatPnl(pnl)}
        </p>

        {/* 3-col stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Entry price",  value: fmtPrice(trade.entryPrice) },
            { label: "Exit price",   value: fmtPrice(trade.exitPrice) },
            { label: "Size (lots)",  value: fmtPrice(trade.sizeLots) },
            { label: "Commission",   value: trade.commission ? formatPnl(parseFloat(trade.commission)) : "—" },
            { label: "Swap",         value: trade.swap ? formatPnl(parseFloat(trade.swap)) : "—" },
            { label: "Duration",     value: fmtDuration(trade.entryAt, trade.exitAt) },
          ].map(({ label, value }) => (
            <div key={label}>
              <span style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 }}>{label}</span>
              <span style={{ fontSize: 12, color: "#B0A898" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Screenshots ── */}
      <div style={CARD}>
        <label style={LABEL_SM}>Chart screenshot</label>
        {screenshots.length === 0 ? (
          <p style={{ fontSize: 12, color: "#4B6080", margin: 0 }}>No screenshot attached</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {screenshots.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={s.r2Url} alt="Chart screenshot"
                style={{ width: "100%", borderRadius: 8, display: "block" }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Emotion log ── */}
      <div style={CARD}>
        <label style={LABEL_SM}>Emotional data</label>
        {!emotionLog ? (
          <p style={{ fontSize: 12, color: "#4B6080", margin: 0 }}>No emotional data logged for this trade</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <MoodDisplay value={emotionLog.preMood} label="Pre-trade mood" />
              {emotionLog.preNote && (
                <p style={{ fontSize: 12, color: "#B0A898", marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
                  {emotionLog.preNote}
                </p>
              )}
            </div>
            {(emotionLog.postMood || emotionLog.postNote) && (
              <div style={{ borderTop: "1px solid #1A2640", paddingTop: 14 }}>
                <MoodDisplay value={emotionLog.postMood} label="Post-trade mood" />
                {emotionLog.postNote && (
                  <p style={{ fontSize: 12, color: "#B0A898", marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
                    {emotionLog.postNote}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Rule compliance ── */}
      {violations.length > 0 && (
        <div style={CARD}>
          <label style={LABEL_SM}>Rule compliance</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {violations.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, lineHeight: 1, color: "#F07C7C" }}>✕</span>
                <span style={{ fontSize: 12, color: "#B0A898" }}>{v.ruleTitle ?? "Deleted rule"}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#4B6080", marginTop: 10, marginBottom: 0 }}>
            {violations.length} rule{violations.length !== 1 ? "s" : ""} broken on this trade
          </p>
        </div>
      )}

      {/* ── Trade metadata ── */}
      <div style={CARD}>
        <label style={LABEL_SM}>Trade info</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Source",       value: trade.source.toUpperCase() },
            { label: "Paper trade",  value: trade.isPaperTrade ? "Yes" : "No" },
            { label: "Entry time",   value: fmtDt(trade.entryAt) },
            { label: "Exit time",    value: trade.exitAt ? fmtDt(trade.exitAt) : "—" },
            ...(trade.brokerTradeId ? [{ label: "Broker ticket", value: trade.brokerTradeId }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <span style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 }}>{label}</span>
              <span style={{ fontSize: 12, color: "#B0A898", wordBreak: "break-all" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setShowEdit(true)} style={{
          flex: 1, height: 44, borderRadius: 8,
          backgroundColor: "#0A1220", border: "1px solid #1A2640",
          color: "#6B8AAA", fontSize: 13, fontWeight: 500,
          fontFamily: "inherit", cursor: "pointer",
        }}>Edit</button>
        <button type="button" onClick={() => setShowDelete(true)} style={{
          flex: 1, height: 44, borderRadius: 8,
          backgroundColor: "#1A0808", border: "1px solid #F07C7C",
          color: "#F07C7C", fontSize: 13, fontWeight: 500,
          fontFamily: "inherit", cursor: "pointer",
        }}>Delete</button>
      </div>

      {/* ── Modals ── */}
      {showEdit   && <EditModal trade={trade} onClose={() => setShowEdit(false)} onSaved={handleSaved} />}
      {showDelete && <DeleteConfirm tradeId={trade.id} onClose={() => setShowDelete(false)} onDeleted={handleDeleted} />}

    </div>
  );
}
