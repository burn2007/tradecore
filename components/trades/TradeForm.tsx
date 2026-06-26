"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MoodSelector from "./MoodSelector";
import { offlineSave, offlineGetAll, offlineRemove } from "@/lib/offline-store";
import type { Rule } from "@/db/schema/rules";
import type { SetupTag } from "@/db/schema/setup_tags";

/* ── Shared style constants ── */
const CARD: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 11,
  padding: "14px 16px",
  marginBottom: 12,
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
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#2E4060",
  fontWeight: 500,
  marginBottom: 6,
};
const PILL_BTN: React.CSSProperties = {
  backgroundColor: "#0A1220",
  border: "1px solid #1A2640",
  borderRadius: 5,
  padding: "3px 8px",
  fontSize: 10,
  color: "#4B6080",
  cursor: "pointer",
  fontFamily: "inherit",
};

/* ── P&L auto-calculator ── */
function calcPnl(
  sym: string,
  dir: "long" | "short",
  entry: number,
  exit: number,
  lots: number
): number {
  const s = sym.toUpperCase();
  let raw: number;
  if (s.startsWith("XAU"))           raw = (exit - entry) * lots * 100;
  else if (s.includes("JPY"))        raw = ((exit - entry) * lots * 100_000) / exit;
  else if (s.endsWith("USDT") || s.endsWith("BUSD")) raw = (exit - entry) * lots;
  else                               raw = (exit - entry) * lots * 100_000;
  return dir === "short" ? -raw : raw;
}

const COMMON_SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY", "NAS100", "GBPJPY", "USDNGN"];

type Outcome = "win" | "loss" | "breakeven" | "";

interface Props {
  rules: Rule[];
  setupTags: SetupTag[];
}

export default function TradeForm({ rules, setupTags }: Props) {
  const router = useRouter();

  /* ── Stage 1 state ── */
  const [symbol, setSymbol]           = useState("");
  const [direction, setDirection]     = useState<"long" | "short" | "">("");
  const [setupTag, setSetupTag]       = useState("");
  const [showSetupDd, setShowSetupDd] = useState(false);
  const [entryPrice, setEntryPrice]   = useState("");
  const [sizeLots, setSizeLots]       = useState("");
  const [exitPrice, setExitPrice]     = useState("");
  const [exitAt, setExitAt]           = useState("");
  const [pnlUsd, setPnlUsd]           = useState("");
  const [entryAt, setEntryAt]         = useState("");
  const [preMood, setPreMood]         = useState(3);
  const [preNote, setPreNote]         = useState("");
  const [screenshotUrl, setScreenshotUrl]       = useState("");
  const [screenshotKey, setScreenshotKey]       = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [uploadingShot, setUploadingShot] = useState(false);
  const [dragOver, setDragOver]       = useState(false);

  /* ── Outcome selector state ── */
  const [outcome, setOutcome]         = useState<Outcome>("");
  const [pnlMagnitude, setPnlMagnitude] = useState("");
  const [autoSelected, setAutoSelected] = useState(false);

  /* ── Stage management ── */
  const [stage, setStage]             = useState<1 | 2>(1);
  const [savedTradeId, setSavedTradeId] = useState("");
  const [savedSymbol, setSavedSymbol] = useState("");
  const [savedDir, setSavedDir]       = useState<"long" | "short">("long");
  const [savedPnl, setSavedPnl]       = useState<string | null>(null);

  /* ── Stage 2 state ── */
  const [ruleCompliance, setRuleCompliance] = useState<Record<string, boolean>>({});
  const [postMood, setPostMood]         = useState(3);
  const [postNote, setPostNote]         = useState("");

  /* ── UI state ── */
  const [saving, setSaving]             = useState(false);
  const [completing, setCompleting]     = useState(false);
  const [offlineDone, setOfflineDone]   = useState(false);
  const [error, setError]               = useState("");

  const fileRef   = useRef<HTMLInputElement>(null);
  const setupRef  = useRef<HTMLDivElement>(null);

  /* ── Derive final pnlUsd from outcome + magnitude ── */
  const derivePnlValue = useCallback((): string => {
    if (outcome === "breakeven") return "0";
    if (outcome === "win" && pnlMagnitude) return pnlMagnitude;
    if (outcome === "loss" && pnlMagnitude) return String(-Math.abs(parseFloat(pnlMagnitude)));
    return "";
  }, [outcome, pnlMagnitude]);

  // Sync derived P&L back to the main pnlUsd state whenever outcome/magnitude changes
  useEffect(() => {
    const val = derivePnlValue();
    setPnlUsd(val);
  }, [derivePnlValue]);

  /* ── Smart auto-selection from entry/exit/direction ── */
  useEffect(() => {
    const e = parseFloat(entryPrice), x = parseFloat(exitPrice), l = parseFloat(sizeLots);
    if (isNaN(e) || isNaN(x) || !direction) return;
    const lots = isNaN(l) || l <= 0 ? 1 : l;
    const computed = calcPnl(symbol, direction as "long" | "short", e, x, lots);
    if (computed > 0) {
      setOutcome("win");
      setPnlMagnitude(isNaN(l) || l <= 0 ? "" : computed.toFixed(2));
    } else if (computed < 0) {
      setOutcome("loss");
      setPnlMagnitude(isNaN(l) || l <= 0 ? "" : Math.abs(computed).toFixed(2));
    } else {
      setOutcome("breakeven");
      setPnlMagnitude("");
    }
    setAutoSelected(true);
  }, [entryPrice, exitPrice, direction, sizeLots, symbol]);

  /* Seed entry time and rule defaults */
  useEffect(() => {
    const now = new Date(); now.setSeconds(0, 0);
    setEntryAt(now.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    const init: Record<string, boolean> = {};
    rules.forEach((r) => { init[r.id] = true; });
    setRuleCompliance(init);
  }, [rules]);

  /* Close setup dropdown on outside click */
  useEffect(() => {
    function h(e: MouseEvent) {
      if (setupRef.current && !setupRef.current.contains(e.target as Node)) setShowSetupDd(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* Replay pending offline trades when connection returns */
  useEffect(() => {
    async function sync() {
      const pending = await offlineGetAll();
      for (const p of pending) {
        try {
          const res = await fetch("/api/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p.data),
          });
          if (res.ok) await offlineRemove(p.offlineId);
        } catch {}
      }
    }
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  /* ── Screenshot upload ── */
  async function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploadingShot(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/screenshot", { method: "POST", body: fd });
      if (res.ok) {
        const { url, key } = await res.json();
        setScreenshotUrl(url);
        setScreenshotKey(key);
      }
    } catch {} finally { setUploadingShot(false); }
  }

  /* ── P&L calculator (for the text link) ── */
  function handleCalcPnl() {
    const e = parseFloat(entryPrice), x = parseFloat(exitPrice), l = parseFloat(sizeLots);
    if (isNaN(e) || isNaN(x) || isNaN(l) || !direction) return;
    setAutoSelected(false);
    const computed = calcPnl(symbol, direction as "long" | "short", e, x, l);
    if (computed > 0) {
      setOutcome("win");
      setPnlMagnitude(computed.toFixed(2));
    } else if (computed < 0) {
      setOutcome("loss");
      setPnlMagnitude(Math.abs(computed).toFixed(2));
    } else {
      setOutcome("breakeven");
      setPnlMagnitude("");
    }
  }

  /* ── Outcome button handler ── */
  function handleOutcomeClick(o: Outcome) {
    setAutoSelected(false);
    if (o === "breakeven") {
      setOutcome("breakeven");
      setPnlMagnitude("");
      return;
    }
    setOutcome(o);
  }

  /* ── Stage 1 submit ── */
  async function handleSave() {
    if (symbol.length < 3)                                   { setError("Symbol required (min 3 chars)"); return; }
    if (!direction)                                          { setError("Select Long or Short"); return; }

    // Entry price + size only required if no manual P&L was set
    const hasPnl = pnlUsd !== "" && !isNaN(parseFloat(pnlUsd));
    const hasEntry = entryPrice && parseFloat(entryPrice) > 0;
    const hasSize = sizeLots && parseFloat(sizeLots) > 0;

    if (!hasPnl && !hasEntry) { setError("Enter an entry price or set P&L manually"); return; }
    if (hasEntry && !hasSize) { setError("Enter a valid lot size"); return; }

    setError(""); setSaving(true);

    const hasExitPrice = !!exitPrice && !isNaN(parseFloat(exitPrice));
    const resolvedExitAt = exitAt
      ? new Date(exitAt).toISOString()
      : hasExitPrice
        ? new Date().toISOString()
        : "";

    const payload: Record<string, unknown> = {
      symbol: symbol.toUpperCase(), direction,
      entryAt: new Date(entryAt).toISOString(),
      preMood,
      ...(hasEntry && { entryPrice: parseFloat(entryPrice) }),
      ...(hasSize && { sizeLots: parseFloat(sizeLots) }),
      ...(hasExitPrice && { exitPrice: parseFloat(exitPrice) }),
      ...(resolvedExitAt && { exitAt: resolvedExitAt }),
      ...(hasPnl && { pnlUsd: parseFloat(pnlUsd) }),
      ...(setupTag && { setupTag }),
      ...(preNote && { preNote }),
      ...(screenshotUrl && { screenshotUrl, screenshotKey }),
    };

    if (!navigator.onLine) {
      await offlineSave(payload);
      setOfflineDone(true); setSaving(false); return;
    }

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
      const trade = await res.json();
      setSavedTradeId(trade.id); setSavedSymbol(trade.symbol);
      setSavedDir(trade.direction as "long" | "short"); setSavedPnl(trade.pnlUsd);
      setStage(2);
    } catch {
      await offlineSave(payload);
      setOfflineDone(true);
    } finally { setSaving(false); }
  }

  /* ── Stage 2 submit ── */
  async function handleComplete() {
    setCompleting(true); setError("");
    const violatedRuleIds = Object.entries(ruleCompliance)
      .filter(([, ok]) => !ok).map(([id]) => id);
    try {
      const res = await fetch(`/api/trades/${savedTradeId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postMood, postNote: postNote || undefined, violatedRuleIds }),
      });
      if (!res.ok) throw new Error();
      router.push("/journal");
    } catch { setError("Failed to save review. Please try again."); }
    finally   { setCompleting(false); }
  }

  /* ── Confirmation line helpers ── */
  const confirmationText = (): string => {
    if (outcome === "breakeven") return "Logging as: Break-even of $0.00";
    if (!outcome) return "";
    const mag = parseFloat(pnlMagnitude);
    if (isNaN(mag)) return "";
    const label = outcome === "win" ? "Win" : "Loss";
    return `Logging as: ${label} of $${mag.toFixed(2)}`;
  };
  const confirmationColor = (): string => {
    if (outcome === "win") return "#50E3B8";
    if (outcome === "loss") return "#F07C7C";
    return "#4B6080";
  };

  /* ── Outcome button styles ── */
  const outcomeBtn = (type: Outcome): React.CSSProperties => {
    const sel = outcome === type;
    const base: React.CSSProperties = {
      flex: 1, height: 44, borderRadius: 8, fontSize: 13, fontWeight: sel ? 500 : 400,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s ease",
    };
    if (!sel) return { ...base, backgroundColor: "#0A0F1A", border: "1px solid #1A2640", color: "#4B6080" };
    if (type === "win") return { ...base, backgroundColor: "#0D2420", border: "1px solid #50E3B8", color: "#50E3B8" };
    if (type === "loss") return { ...base, backgroundColor: "#240808", border: "1px solid #F07C7C", color: "#F07C7C" };
    /* breakeven */ return { ...base, backgroundColor: "#151F30", border: "1px solid #4B6080", color: "#8BA8C4" };
  };

  /* ── Offline confirmation screen ── */
  if (offlineDone) return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 80 }}>
      <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", marginBottom: 16 }}>Log a trade</p>
      <div style={{ ...CARD, borderLeft: "3px solid #50E3B8", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#50E3B8", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "#50E3B8" }}>Saved offline — will sync when connected</span>
      </div>
      <p style={{ fontSize: 12, color: "#6B8AAA", marginTop: 12 }}>
        Your trade is stored on your device and will upload automatically once you are back online.
      </p>
    </div>
  );

  /* ── Stage 2: post-trade review ── */
  if (stage === 2) {
    const pnlNum   = savedPnl ? parseFloat(savedPnl) : null;
    const pnlColor = pnlNum !== null ? (pnlNum >= 0 ? "#50E3B8" : "#F07C7C") : "#8BA8C4";

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 80 }}>
        {/* Success banner + trade summary */}
        <div style={{ ...CARD, borderLeft: "3px solid #50E3B8" }}>
          <p style={{ fontSize: 12, color: "#50E3B8", margin: "0 0 10px", fontWeight: 500 }}>
            Trade saved. Now review your execution.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#C9C2AE" }}>{savedSymbol}</span>
            <span style={{
              fontSize: 11, fontWeight: 500, borderRadius: 5, padding: "2px 8px",
              color: savedDir === "long" ? "#50E3B8" : "#F07C7C",
              backgroundColor: savedDir === "long" ? "#0D2420" : "#240808",
              border: `1px solid ${savedDir === "long" ? "#50E3B8" : "#F07C7C"}`,
            }}>{savedDir.toUpperCase()}</span>
            {pnlNum !== null && (
              <span style={{ fontSize: 13, fontWeight: 500, color: pnlColor, marginLeft: "auto" }}>
                {pnlNum >= 0 ? "+" : ""}${pnlNum.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Rule compliance */}
        <div style={CARD}>
          <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 14px" }}>Did you follow your rules?</p>
          {rules.length === 0 ? (
            <p style={{ fontSize: 12, color: "#4B6080" }}>
              You have no rules yet.{" "}
              <Link href="/settings/rules" style={{ color: "#E2B96F", textDecoration: "none" }}>Add rules in Settings</Link>
              {" "}to track compliance.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((rule) => {
                const followed = ruleCompliance[rule.id] !== false;
                return (
                  <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#B0A898", flex: 1 }}>{rule.title}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["Yes", "No"] as const).map((opt) => {
                        const isYes = opt === "Yes", sel = isYes ? followed : !followed;
                        return (
                          <button key={opt} type="button"
                            onClick={() => setRuleCompliance((p) => ({ ...p, [rule.id]: isYes }))}
                            style={{
                              height: 30, padding: "0 12px", borderRadius: 6,
                              fontSize: 11, fontWeight: sel ? 500 : 400,
                              cursor: "pointer", fontFamily: "inherit",
                              backgroundColor: sel ? (isYes ? "#0D2420" : "#240808") : "#0A0F1A",
                              border: `1px solid ${sel ? (isYes ? "#50E3B8" : "#F07C7C") : "#1A2640"}`,
                              color: sel ? (isYes ? "#50E3B8" : "#F07C7C") : "#4B6080",
                            }}>{opt}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Post-trade mood */}
        <div style={CARD}>
          <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 14px" }}>How do you feel about this trade now?</p>
          <MoodSelector value={postMood} onChange={setPostMood} />
        </div>

        {/* Post-trade note */}
        <div style={CARD}>
          <label style={LABEL}>Post-trade reflection</label>
          <textarea value={postNote} onChange={(e) => setPostNote(e.target.value)} rows={4}
            placeholder="What would you do differently? What did you do well?"
            style={{ ...INPUT, height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.55 }} />
        </div>

        {error && <p style={{ color: "#F07C7C", fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <button type="button" onClick={handleComplete} disabled={completing} style={{
          width: "100%", height: 44, backgroundColor: "#0D2420",
          border: "1px solid #50E3B8", borderRadius: 8, color: "#50E3B8",
          fontSize: 14, fontWeight: 500, cursor: completing ? "not-allowed" : "pointer",
          fontFamily: "inherit", opacity: completing ? 0.7 : 1,
        }}>{completing ? "Saving…" : "Complete review"}</button>
      </div>
    );
  }

  /* ── Stage 1: trade entry ── */
  const filteredTags = setupTags.filter((t) => t.name.toLowerCase().includes(setupTag.toLowerCase()));

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 80 }}>
      <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: "0 0 16px" }}>Log a trade</p>

      {/* Card 1 — Trade basics */}
      <div style={CARD}>
        <label style={LABEL}>Symbol</label>
        <input type="text" value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="EURUSD, XAUUSD, BTCUSDT..."
          style={{ ...INPUT, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {COMMON_SYMBOLS.map((s) => (
            <button key={s} type="button" onClick={() => setSymbol(s)} style={PILL_BTN}>{s}</button>
          ))}
        </div>

        <label style={LABEL}>Direction</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["long", "short"] as const).map((d) => {
            const sel = direction === d, isLong = d === "long";
            return (
              <button key={d} type="button" onClick={() => setDirection(d)} style={{
                flex: 1, height: 44, borderRadius: 8, fontSize: 13, fontWeight: sel ? 500 : 400,
                cursor: "pointer", fontFamily: "inherit",
                backgroundColor: sel ? (isLong ? "#0D2420" : "#240808") : "#0A0F1A",
                border: `1px solid ${sel ? (isLong ? "#50E3B8" : "#F07C7C") : "#1A2640"}`,
                color: sel ? (isLong ? "#50E3B8" : "#F07C7C") : "#4B6080",
              }}>{isLong ? "Long" : "Short"}</button>
            );
          })}
        </div>

        <label style={LABEL}>Setup</label>
        <div ref={setupRef} style={{ position: "relative" }}>
          <input type="text" value={setupTag}
            onChange={(e) => setSetupTag(e.target.value)}
            onFocus={() => setShowSetupDd(true)}
            placeholder="e.g. London breakout, OB retest"
            style={INPUT} />
          {showSetupDd && (filteredTags.length > 0 || setupTag) && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              backgroundColor: "#0F1623", border: "1px solid #1A2640", borderRadius: 8,
              padding: 8, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}>
              {filteredTags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: setupTag ? 8 : 0 }}>
                  {filteredTags.map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => { setSetupTag(t.name); setShowSetupDd(false); }}
                      style={{ ...PILL_BTN, fontSize: 11, color: "#6B8AAA" }}>{t.name}</button>
                  ))}
                </div>
              )}
              {setupTag && !filteredTags.find((t) => t.name === setupTag) && (
                <p style={{ fontSize: 10, color: "#4B6080", margin: 0 }}>
                  Press Enter to use &ldquo;{setupTag}&rdquo; as a new tag
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card 2 — Entry details */}
      <div style={CARD}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LABEL}>Entry price</label>
            <input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)}
              step="any" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>Size (lots)</label>
            <input type="number" value={sizeLots} onChange={(e) => setSizeLots(e.target.value)}
              step="0.01" min="0" style={INPUT} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={LABEL as React.CSSProperties}>Exit price</span>
            <span style={{ fontSize: 9, color: "#4B6080", backgroundColor: "#0A1220",
              border: "1px solid #1A2640", borderRadius: 4, padding: "1px 5px" }}>optional</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input type="number" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)}
              step="any" placeholder="Exit price" style={INPUT} />
            <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)}
              style={{ ...INPUT, colorScheme: "dark" } as React.CSSProperties}
              title="Exit time (optional)" />
          </div>
          <p style={{ fontSize: 10, color: "#2E4060", marginTop: 4 }}>Exit time is used to calculate trade duration.</p>
        </div>

        {/* ── P&L Outcome Selector ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={LABEL as React.CSSProperties}>Outcome</span>
            {autoSelected && outcome && (
              <span style={{
                fontSize: 9, color: "#E2B96F", backgroundColor: "#1A1608",
                border: "1px solid #3A2E12", borderRadius: 4, padding: "1px 5px",
              }}>auto-detected</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button type="button" onClick={() => handleOutcomeClick("win")} style={outcomeBtn("win")}>Win</button>
            <button type="button" onClick={() => handleOutcomeClick("loss")} style={outcomeBtn("loss")}>Loss</button>
            <button type="button" onClick={() => handleOutcomeClick("breakeven")} style={outcomeBtn("breakeven")}>Break-even</button>
          </div>

          {/* Break-even confirmation chip */}
          {outcome === "breakeven" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              backgroundColor: "#151F30", border: "1px solid #1A2640", borderRadius: 6,
              padding: "8px 12px",
            }}>
              <span style={{ fontSize: 12, color: "#4B6080" }}>P&amp;L set to $0.00</span>
            </div>
          )}

          {/* Win/Loss magnitude input with locked sign prefix */}
          {(outcome === "win" || outcome === "loss") && (
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <div style={{
                height: 40, width: 36, display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#0A0F1A", border: "1px solid #1A2640", borderRight: "none",
                borderRadius: "8px 0 0 8px", flexShrink: 0,
                color: outcome === "win" ? "#50E3B8" : "#F07C7C",
                fontSize: 16, fontWeight: 500,
              }}>
                {outcome === "win" ? "+" : "−"}
              </div>
              <input
                type="number"
                value={pnlMagnitude}
                onChange={(e) => { setPnlMagnitude(e.target.value); setAutoSelected(false); }}
                placeholder="0.00"
                step="0.01"
                style={{
                  ...INPUT,
                  borderRadius: "0 8px 8px 0",
                  flex: 1,
                }}
              />
            </div>
          )}

          {/* Live confirmation line */}
          {outcome && confirmationText() && (
            <p style={{
              fontSize: 11, color: confirmationColor(), margin: "8px 0 0",
              fontWeight: 400,
            }}>
              {confirmationText()}
            </p>
          )}

          {/* Secondary calculate link */}
          <button
            type="button"
            onClick={handleCalcPnl}
            style={{
              background: "none", border: "none", padding: 0, marginTop: 8,
              fontSize: 11, color: "#4B6080", cursor: "pointer",
              fontFamily: "inherit", textDecoration: "underline",
              display: "block",
            }}
          >
            Or calculate from entry and exit price
          </button>
        </div>

        <div>
          <label style={LABEL}>Entry time</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="datetime-local" value={entryAt} onChange={(e) => setEntryAt(e.target.value)}
              style={{ ...INPUT, flex: 1, colorScheme: "dark" } as React.CSSProperties} />
            <button type="button" onClick={() => {
              const now = new Date(); now.setSeconds(0, 0);
              setEntryAt(now.toISOString().slice(0, 16));
            }} style={{
              height: 40, padding: "0 12px", backgroundColor: "#0A1220",
              border: "1px solid #1A2640", borderRadius: 8,
              fontSize: 11, color: "#6B8AAA", cursor: "pointer",
              fontFamily: "inherit", flexShrink: 0,
            }}>Now</button>
          </div>
        </div>
      </div>

      {/* Card 3 — Pre-trade mental state */}
      <div style={CARD}>
        <p style={{ fontSize: 11, color: "#6B8AAA", margin: "0 0 14px" }}>How are you feeling right now?</p>
        <MoodSelector value={preMood} onChange={setPreMood} />
        <textarea value={preNote} onChange={(e) => setPreNote(e.target.value)} rows={3}
          placeholder="What is your reasoning for this trade?"
          style={{ ...INPUT, height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.55, marginTop: 12 }} />
      </div>

      {/* Card 4 — Screenshot */}
      <div style={CARD}>
        {screenshotPreview ? (
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshotPreview} alt="Chart screenshot"
              style={{ width: "100%", borderRadius: 6, display: "block" }} />
            <button type="button"
              onClick={() => { setScreenshotPreview(""); setScreenshotUrl(""); setScreenshotKey(""); }}
              style={{
                position: "absolute", top: 6, right: 6, width: 24, height: 24,
                borderRadius: "50%", backgroundColor: "rgba(10,15,26,0.85)",
                border: "1px solid #1A2640", color: "#F07C7C", fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            {uploadingShot && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 6,
                backgroundColor: "rgba(10,15,26,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 12, color: "#6B8AAA" }}>Uploading…</span>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `1.5px dashed ${dragOver ? "#4B6080" : "#1A2640"}`,
              borderRadius: 8, backgroundColor: dragOver ? "#0D1525" : "#0A0F1A",
              padding: 20, height: 80,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "border-color 0.15s, background-color 0.15s",
            }}>
            <span style={{ fontSize: 12, color: "#2E4060", textAlign: "center" }}>
              Drop your chart screenshot here or tap to browse
            </span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
      </div>

      {error && <p style={{ color: "#F07C7C", fontSize: 12, marginBottom: 12 }}>{error}</p>}

      <button type="button" onClick={handleSave} disabled={saving} style={{
        width: "100%", height: 44, backgroundColor: "#E2B96F", border: "none",
        borderRadius: 8, color: "#0A0F1A", fontSize: 14, fontWeight: 500,
        cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1,
      }}>{saving ? "Saving…" : "Save trade"}</button>
    </div>
  );
}
