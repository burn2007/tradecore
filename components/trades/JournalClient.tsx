"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { SetupTag } from "@/db/schema/setup_tags";
import TradeRow, { type TradeRowData } from "./TradeRow";

/* ── Types ── */
interface ApiResponse {
  data: TradeRowData[];
  total: number;
  limit: number;
  offset: number;
}

/* ── Helpers ── */
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── Shared style constants ── */
const CARD: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 8,
  padding: "10px 14px",
  marginBottom: 6,
  cursor: "pointer",
  transition: "border-color 0.15s",
};
const INPUT: React.CSSProperties = {
  backgroundColor: "#0A0F1A",
  border: "1px solid #1A2640",
  borderRadius: 8,
  color: "#C9C2AE",
  height: 36,
  padding: "0 10px",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
/* ── Props ── */
interface Props {
  setupTags: SetupTag[];
  userId: string;
}

/* ── Component ── */
export default function JournalClient({ setupTags, userId }: Props) {
  /* ── Filter state ── */
  const [from,      setFrom]      = useState(startOfMonth());
  const [to,        setTo]        = useState(today());
  const [symbol,    setSymbol]    = useState("");
  const [setupTag,  setSetupTag]  = useState("");
  const [direction, setDirection] = useState("");
  const [session,   setSession]   = useState("");
  const [offset,    setOffset]    = useState(0);
  const LIMIT = 50;

  // Reset offset when filters change
  useEffect(() => { setOffset(0); }, [from, to, symbol, setupTag, direction, session]);

  /* ── Query ── */
  const buildUrl = useCallback(() => {
    const p = new URLSearchParams();
    if (from)      p.set("from",      from);
    if (to)        p.set("to",        to);
    if (symbol)    p.set("symbol",    symbol);
    if (setupTag)  p.set("setupTag",  setupTag);
    if (direction) p.set("direction", direction);
    if (session)   p.set("session",   session);
    p.set("limit",  String(LIMIT));
    p.set("offset", String(offset));
    return `/api/trades?${p}`;
  }, [from, to, symbol, setupTag, direction, session, offset]);

  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["trades", userId, from, to, symbol, setupTag, direction, session, offset],
    queryFn: async () => {
      const res = await fetch(buildUrl());
      if (!res.ok) throw new Error("Failed to fetch trades");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const trades = data?.data ?? [];
  const total  = data?.total ?? 0;
  const showing = offset + trades.length;

  function clearFilters() {
    setFrom(startOfMonth());
    setTo(today());
    setSymbol("");
    setSetupTag("");
    setDirection("");
    setSession("");
    setOffset(0);
  }

  /* ── Render ── */
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 40 }}>

      {/* ── Header row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 }}>
        <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: 0 }}>Journal</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/journal/import" style={{
            display: "inline-flex", alignItems: "center",
            height: 36, padding: "0 14px", borderRadius: 8,
            backgroundColor: "#111C2E", border: "1px solid #1A2640",
            color: "#6B8AAA", fontSize: 12, fontWeight: 500,
            textDecoration: "none", whiteSpace: "nowrap",
          }}>Import CSV</Link>
          <Link href="/journal/new" style={{
            display: "inline-flex", alignItems: "center",
            height: 36, padding: "0 14px", borderRadius: 8,
            backgroundColor: "#E2B96F", border: "none",
            color: "#0A0F1A", fontSize: 12, fontWeight: 500,
            textDecoration: "none", whiteSpace: "nowrap",
          }}>+ Log trade</Link>
        </div>
      </div>

      {/* ── Filters card ── */}
      <div style={{
        backgroundColor: "#111C2E", border: "1px solid #1A2640",
        borderRadius: 11, padding: "12px 14px", marginBottom: 14,
      }}>
        {/* Row 1: date range + symbol */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...INPUT, colorScheme: "dark" } as React.CSSProperties} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...INPUT, colorScheme: "dark" } as React.CSSProperties} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Symbol</label>
            <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)}
              placeholder="Filter by symbol..." style={INPUT} />
          </div>
        </div>

        {/* Row 2: setup tag + direction + session + clear */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Setup</label>
            <select value={setupTag} onChange={(e) => setSetupTag(e.target.value)} style={{ ...INPUT, paddingRight: 8 } as React.CSSProperties}>
              <option value="">All setups</option>
              {setupTags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          {/* Direction segmented control */}
          <div>
            <label style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Direction</label>
            <div style={{ display: "flex", gap: 0, border: "1px solid #1A2640", borderRadius: 8, overflow: "hidden" }}>
              {(["", "long", "short"] as const).map((d) => (
                <button key={d || "all"} type="button" onClick={() => setDirection(d)} style={{
                  height: 36, padding: "0 10px", fontSize: 11, fontWeight: 500,
                  fontFamily: "inherit", cursor: "pointer", border: "none",
                  backgroundColor: direction === d ? "#1A2640" : "#0A0F1A",
                  color: direction === d ? "#C9C2AE" : "#4B6080",
                  transition: "background-color 0.15s",
                }}>
                  {d === "" ? "All" : d === "long" ? "Long" : "Short"}
                </button>
              ))}
            </div>
          </div>

          {/* Session dropdown */}
          <div>
            <label style={{ fontSize: 9, color: "#2E4060", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)} style={{ ...INPUT, width: "auto", paddingRight: 8 } as React.CSSProperties}>
              <option value="">All Sessions</option>
              <option value="london">London</option>
              <option value="newyork">New York</option>
              <option value="asian">Asian</option>
              <option value="african">African</option>
            </select>
          </div>

          {/* Clear filters */}
          <button type="button" onClick={clearFilters} style={{
            height: 36, padding: "0 10px", backgroundColor: "transparent",
            border: "none", color: "#4B6080", fontSize: 11, cursor: "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}>Clear filters</button>
        </div>
      </div>

      {/* ── Trade count ── */}
      {!isLoading && !isError && (
        <p style={{ fontSize: 11, color: "#4B6080", marginBottom: 10 }}>
          {total === 0 ? "No trades found" : `Showing ${showing} of ${total} trade${total !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4B6080", fontSize: 13 }}>
          Loading trades…
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div style={{ ...CARD, borderLeft: "3px solid #F07C7C", cursor: "default" }}>
          <p style={{ fontSize: 13, color: "#F07C7C", margin: 0 }}>Failed to load trades. Please try again.</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !isError && trades.length === 0 && (
        <div style={{
          ...CARD, cursor: "default", padding: "40px 20px",
          textAlign: "center", borderRadius: 11,
        }}>
          {/* Simple chart SVG illustration */}
          <svg width="64" height="40" viewBox="0 0 64 40" fill="none" style={{ marginBottom: 16 }}>
            <polyline points="2,34 14,20 26,28 38,10 50,16 62,4"
              stroke="#2E4060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="62" cy="4" r="2.5" fill="#E2B96F" />
          </svg>
          <p style={{ fontSize: 14, color: "#6B8AAA", marginBottom: 6 }}>No trades yet.</p>
          <p style={{ fontSize: 12, color: "#4B6080", marginBottom: 20 }}>
            Start by logging your first trade or importing your MT5 history.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/journal/new" style={{
              display: "inline-flex", alignItems: "center",
              height: 36, padding: "0 16px", borderRadius: 8,
              backgroundColor: "#E2B96F", color: "#0A0F1A",
              fontSize: 12, fontWeight: 500, textDecoration: "none",
            }}>Log a trade</Link>
            <Link href="/journal/import" style={{
              display: "inline-flex", alignItems: "center",
              height: 36, padding: "0 16px", borderRadius: 8,
              backgroundColor: "#111C2E", border: "1px solid #1A2640",
              color: "#6B8AAA", fontSize: 12, fontWeight: 500, textDecoration: "none",
            }}>Import CSV</Link>
          </div>
        </div>
      )}

      {/* ── Trade list ── */}
      {!isLoading && trades.map((trade) => (
        <TradeRow key={trade.id} trade={trade} />
      ))}

      {/* ── Load more ── */}
      {!isLoading && !isError && showing < total && (
        <button type="button" onClick={() => setOffset(offset + LIMIT)} style={{
          width: "100%", height: 40, marginTop: 8,
          backgroundColor: "#111C2E", border: "1px solid #1A2640",
          borderRadius: 8, color: "#6B8AAA", fontSize: 12,
          fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          Load more ({total - showing} remaining)
        </button>
      )}

    </div>
  );
}
