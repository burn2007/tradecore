"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });
    // Always show the same message — never reveal whether the email exists
    setSent(true);
    setLoading(false);
  }

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "400px",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "11px",
    borderTop: "2px solid var(--color-gold)",
    padding: "2rem",
  };

  if (sent) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ ...cardStyle, borderTop: "2px solid var(--color-jade)", textAlign: "center" }}>
          <p style={{ color: "var(--color-text-primary)", fontSize: "0.9375rem", fontWeight: 500, margin: "0 0 0.5rem" }}>
            Check your email
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", lineHeight: 1.6, margin: 0 }}>
            If an account exists for that email, a reset link has been sent.
          </p>
          <Link
            href="/login"
            style={{ display: "inline-block", marginTop: "1.5rem", color: "var(--color-gold)", textDecoration: "none", fontSize: "0.875rem" }}
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div style={cardStyle}>
        <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
          <h1 style={{ color: "var(--color-gold)", fontSize: "1.5rem", fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>
            TradeCore
          </h1>
          <p style={{ color: "var(--color-text-primary)", fontSize: "0.9375rem", fontWeight: 500, marginTop: "0.5rem", marginBottom: "0.25rem" }}>
            Reset your password
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", margin: 0, lineHeight: 1.5 }}>
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", color: "var(--color-text-secondary)", fontSize: "0.8125rem", marginBottom: "0.375rem" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
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

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "rgba(226, 185, 111, 0.5)" : "var(--color-gold)",
              color: "#0a0f1a",
              border: "none",
              borderRadius: "8px",
              padding: "0.6875rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: "0.875rem", marginTop: "1.5rem" }}>
          <Link href="/login" style={{ color: "var(--color-gold)", textDecoration: "none" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
