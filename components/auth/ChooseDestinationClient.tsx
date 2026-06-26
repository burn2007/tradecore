"use client";

import { useState } from "react";

interface Props {
  firstName: string;
  adminPath: string;
  lastChosen: string | null;
}

export default function ChooseDestinationClient({ firstName, adminPath, lastChosen }: Props) {
  const [remember, setRemember] = useState(false);
  const [hover, setHover] = useState<"trader" | "admin" | null>(null);
  const [loading, setLoading] = useState<"trader" | "admin" | null>(null);

  async function navigate(dest: "trader" | "admin") {
    if (loading) return;
    setLoading(dest);
    if (remember) {
      await fetch("/api/auth/set-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: dest }),
      }).catch(() => {});
    }
    window.location.href = dest === "admin" ? adminPath : "/dashboard";
  }

  function cardBorder(key: "trader" | "admin") {
    if (lastChosen === key) return "1px solid #50E3B8";
    if (hover === key) return "1px solid #2A3A55";
    return "1px solid #1A2640";
  }

  function cardShadow(key: "trader" | "admin") {
    if (lastChosen === key) return "0 0 0 1px rgba(80,227,184,0.2), 0 4px 16px rgba(0,0,0,0.3)";
    return "none";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "11px",
          borderTop: "2px solid var(--color-gold)",
          padding: "2rem",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
          <h1
            style={{
              color: "var(--color-gold)",
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              margin: "0 0 6px",
            }}
          >
            Welcome back, {firstName}
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: 0 }}>
            Where would you like to go?
          </p>
        </div>

        {/* Destination cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {/* Trader app */}
          <button
            type="button"
            disabled={!!loading}
            onClick={() => navigate("trader")}
            onMouseEnter={() => setHover("trader")}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: "1 1 180px",
              background: "#111C2E",
              border: cardBorder("trader"),
              borderRadius: 12,
              padding: 20,
              cursor: loading ? "default" : "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              boxShadow: cardShadow("trader"),
              transition: "border-color 0.15s, box-shadow 0.15s",
              opacity: loading && loading !== "trader" ? 0.5 : 1,
              position: "relative",
            }}
          >
            {lastChosen === "trader" && (
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: "#50E3B8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="#0A0F1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
            {/* Chart icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#E2B96F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 5 }}>
              {loading === "trader" ? "Opening…" : "Trader app"}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              Log trades, review your journal, check your stats
            </div>
          </button>

          {/* Admin panel */}
          <button
            type="button"
            disabled={!!loading}
            onClick={() => navigate("admin")}
            onMouseEnter={() => setHover("admin")}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: "1 1 180px",
              background: "#111C2E",
              border: cardBorder("admin"),
              borderRadius: 12,
              padding: 20,
              cursor: loading ? "default" : "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              boxShadow: cardShadow("admin"),
              transition: "border-color 0.15s, box-shadow 0.15s",
              opacity: loading && loading !== "admin" ? 0.5 : 1,
              position: "relative",
            }}
          >
            {lastChosen === "admin" && (
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: "#50E3B8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="#0A0F1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
            {/* Shield icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#8BA8C4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 5 }}>
              {loading === "admin" ? "Opening…" : "Admin panel"}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              Manage users, review activity, adjust accounts
            </div>
          </button>
        </div>

        {/* Remember choice */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 20,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 13, height: 13, accentColor: "#E2B96F", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Remember my choice for next time
          </span>
        </label>
      </div>
    </main>
  );
}
