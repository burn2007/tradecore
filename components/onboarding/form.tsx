"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MARKETS = [
  { key: "forex", label: "Forex" },
  { key: "crypto", label: "Crypto" },
  { key: "stocks", label: "Stocks" },
  { key: "indices", label: "Indices" },
  { key: "commodities", label: "Commodities" },
  { key: "futures", label: "Futures" },
];

// African timezones first, then common others
const TIMEZONES = [
  { value: "Africa/Lagos", label: "Lagos / Abuja (WAT, UTC+1)" },
  { value: "Africa/Accra", label: "Accra (GMT, UTC+0)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT, UTC+3)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST, UTC+2)" },
  { value: "Africa/Cairo", label: "Cairo (EET, UTC+2)" },
  { value: "Africa/Casablanca", label: "Casablanca (WET, UTC+0)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Frankfurt / Berlin (CET/CEST)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST, UTC+9)" },
  { value: "UTC", label: "UTC" },
];

export default function OnboardingForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [broker, setBroker] = useState("");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleMarket(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selected.length === 0) {
      setError("Please select at least one market.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketsTraded: selected, broker: broker || undefined, timezone }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ? JSON.stringify(data.error) : "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Markets */}
      <div>
        <p style={{ color: "var(--color-text-primary)", fontWeight: 500, marginBottom: "0.75rem" }}>
          Which markets do you trade?
        </p>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Select all that apply — you can change this later in Settings.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
          {MARKETS.map(({ key, label }) => {
            const active = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleMarket(key)}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: "999px",
                  border: active ? "1px solid var(--color-gold)" : "1px solid var(--color-border)",
                  background: active ? "rgba(226, 185, 111, 0.12)" : "var(--color-deep)",
                  color: active ? "var(--color-gold)" : "var(--color-text-secondary)",
                  fontSize: "0.875rem",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Broker */}
      <div>
        <label
          style={{
            display: "block",
            color: "var(--color-text-primary)",
            fontWeight: 500,
            marginBottom: "0.375rem",
          }}
        >
          Broker / Exchange{" "}
          <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: "0.875rem" }}>
            (optional)
          </span>
        </label>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", marginBottom: "0.625rem" }}>
          e.g. ICMarkets, Exness, Binance, FTMO
        </p>
        <input
          type="text"
          value={broker}
          onChange={(e) => setBroker(e.target.value)}
          maxLength={100}
          placeholder="Your broker or exchange"
          style={{
            width: "100%",
            background: "var(--color-deep)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "0.625rem 0.875rem",
            color: "var(--color-text-primary)",
            fontSize: "0.9375rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Timezone */}
      <div>
        <label
          style={{
            display: "block",
            color: "var(--color-text-primary)",
            fontWeight: 500,
            marginBottom: "0.375rem",
          }}
        >
          Your timezone
        </label>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", marginBottom: "0.625rem" }}>
          Used to display session times (London, New York, Tokyo) correctly.
        </p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{
            width: "100%",
            background: "var(--color-deep)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "0.625rem 0.875rem",
            color: "var(--color-text-primary)",
            fontSize: "0.9375rem",
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer",
          }}
        >
          {TIMEZONES.map(({ value, label }) => (
            <option key={value} value={value} style={{ background: "#0a0f1a" }}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(240, 124, 124, 0.1)",
            border: "1px solid rgba(240, 124, 124, 0.3)",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            color: "var(--color-rose)",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          background: loading ? "rgba(226, 185, 111, 0.5)" : "var(--color-gold)",
          color: "#0a0f1a",
          border: "none",
          borderRadius: "8px",
          padding: "0.75rem",
          fontSize: "1rem",
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Saving…" : "Start journaling"}
      </button>
    </form>
  );
}
