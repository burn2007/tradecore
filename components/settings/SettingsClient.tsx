"use client";

import { useState } from "react";
import Link from "next/link";

/* ── Shared style constants (matches Dusk design) ── */
const CARD: React.CSSProperties = {
  backgroundColor: "#111C2E",
  border: "1px solid #1A2640",
  borderRadius: 11,
  padding: "20px 20px",
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
const SELECT: React.CSSProperties = {
  ...{
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
    boxSizing: "border-box" as const,
    appearance: "none" as const,
    cursor: "pointer",
  },
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
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#2E4060",
  fontWeight: 500,
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: "1px solid #0F1A2A",
};

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "GHS", label: "GHS — Ghanaian Cedi" },
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
];

const AFRICAN_TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Abidjan",
  "Africa/Casablanca",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Addis_Ababa",
  "Africa/Kigali",
  "Africa/Douala",
  "Africa/Dakar",
  "Africa/Harare",
  "Africa/Lusaka",
];
const OTHER_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const MARKETS = [
  "Forex",
  "Crypto",
  "Stocks",
  "Indices",
  "Commodities",
  "Futures",
];

interface Props {
  initialDisplayName: string;
  initialCurrency: string;
  initialTimezone: string;
  initialBroker: string;
  initialMarketsTraded: string[];
  email: string;
  tier: string;
}

export default function SettingsClient({
  initialDisplayName,
  initialCurrency,
  initialTimezone,
  initialBroker,
  initialMarketsTraded,
  email,
  tier,
}: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [currency, setCurrency] = useState(initialCurrency);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [broker, setBroker] = useState(initialBroker);
  const [marketsTraded, setMarketsTraded] = useState<string[]>(
    initialMarketsTraded ?? []
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggleMarket(m: string) {
    setMarketsTraded((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          preferredCurrency: currency,
          timezone,
          broker: broker.trim() || undefined,
          marketsTraded,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* ── Profile card ── */}
      <div style={CARD}>
        <p style={SECTION_TITLE}>Profile</p>

        {/* Account badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            padding: "12px 14px",
            backgroundColor: "#0A0F1A",
            borderRadius: 8,
            border: "1px solid #0F1A2A",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "#0F1E30",
              border: "1px solid #1A2640",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 500,
              color: "#E2B96F",
              flexShrink: 0,
            }}
          >
            {(displayName || email || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#C9C2AE",
                margin: "0 0 2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName || email}
            </p>
            <p
              style={{ fontSize: 11, color: "#4B6080", margin: 0 }}
            >
              {email}
            </p>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "3px 8px",
              borderRadius: 5,
              backgroundColor:
                tier === "pro"
                  ? "#1A2A10"
                  : tier === "premium"
                  ? "#1A1A08"
                  : "#0A1220",
              color:
                tier === "pro"
                  ? "#50E3B8"
                  : tier === "premium"
                  ? "#E2B96F"
                  : "#4B6080",
              border: `1px solid ${
                tier === "pro"
                  ? "#50E3B8"
                  : tier === "premium"
                  ? "#E2B96F"
                  : "#1A2640"
              }`,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {tier}
          </span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            style={INPUT}
            maxLength={100}
          />
        </div>

        <div>
          <label style={LABEL}>Email</label>
          <input
            type="email"
            value={email}
            disabled
            style={{ ...INPUT, opacity: 0.45, cursor: "not-allowed" }}
          />
          <p
            style={{ fontSize: 10, color: "#2E4060", marginTop: 5 }}
          >
            Email is managed by your sign-in provider and cannot be changed here.
          </p>
        </div>
      </div>

      {/* ── Preferences card ── */}
      <div style={CARD}>
        <p style={SECTION_TITLE}>Preferences</p>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>P&amp;L display currency</label>
          <div style={{ position: "relative" }}>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={SELECT}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 10 6"
              width="10"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                fill: "#4B6080",
              }}
            >
              <path d="M0 0l5 6 5-6H0z" />
            </svg>
          </div>
        </div>

        <div>
          <label style={LABEL}>Timezone</label>
          <div style={{ position: "relative" }}>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={SELECT}
            >
              <optgroup label="African timezones">
                {AFRICAN_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other timezones">
                {OTHER_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </optgroup>
            </select>
            <svg
              viewBox="0 0 10 6"
              width="10"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                fill: "#4B6080",
              }}
            >
              <path d="M0 0l5 6 5-6H0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Trading profile card ── */}
      <div style={CARD}>
        <p style={SECTION_TITLE}>Trading profile</p>

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Broker / exchange</label>
          <input
            type="text"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            placeholder="e.g. ICMarkets, Binance, FXTM"
            style={INPUT}
            maxLength={100}
          />
        </div>

        <div>
          <label style={LABEL}>Markets traded</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {MARKETS.map((m) => {
              const active = marketsTraded.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMarket(m)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: active ? 500 : 400,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    backgroundColor: active ? "#0F1E30" : "#0A0F1A",
                    border: `1px solid ${active ? "#E2B96F" : "#1A2640"}`,
                    color: active ? "#E2B96F" : "#4B6080",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Quick links card ── */}
      <div style={CARD}>
        <p style={SECTION_TITLE}>Quick links</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Link
            href="/settings/rules"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 0",
              borderBottom: "1px solid #0F1A2A",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg
                viewBox="0 0 20 20"
                width="16"
                fill="none"
                stroke="#E2B96F"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7l2 2 4-4"
                />
              </svg>
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#C9C2AE",
                    margin: 0,
                  }}
                >
                  Trading rules
                </p>
                <p
                  style={{ fontSize: 11, color: "#4B6080", margin: "2px 0 0" }}
                >
                  Define rules to track your compliance
                </p>
              </div>
            </div>
            <svg
              viewBox="0 0 8 14"
              width="7"
              fill="none"
              stroke="#2E4060"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M1 1l6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/journal/import"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 0",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg
                viewBox="0 0 20 20"
                width="16"
                fill="none"
                stroke="#8BA8C4"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h6a3 3 0 003-3v-1m-4-8l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#C9C2AE",
                    margin: 0,
                  }}
                >
                  Import trades
                </p>
                <p
                  style={{ fontSize: 11, color: "#4B6080", margin: "2px 0 0" }}
                >
                  Upload MT4/MT5 CSV history
                </p>
              </div>
            </div>
            <svg
              viewBox="0 0 8 14"
              width="7"
              fill="none"
              stroke="#2E4060"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M1 1l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Error / success feedback ── */}
      {error && (
        <p
          style={{
            fontSize: 12,
            color: "#F07C7C",
            marginBottom: 10,
            padding: "8px 12px",
            backgroundColor: "#240808",
            border: "1px solid #F07C7C",
            borderRadius: 7,
          }}
        >
          {error}
        </p>
      )}
      {saved && (
        <p
          style={{
            fontSize: 12,
            color: "#50E3B8",
            marginBottom: 10,
            padding: "8px 12px",
            backgroundColor: "#0D2420",
            border: "1px solid #50E3B8",
            borderRadius: 7,
          }}
        >
          ✓ Settings saved
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          height: 44,
          backgroundColor: "#E2B96F",
          border: "none",
          borderRadius: 8,
          color: "#0A0F1A",
          fontSize: 14,
          fontWeight: 500,
          cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
