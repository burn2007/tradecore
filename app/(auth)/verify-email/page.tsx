"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { pushToast, ToastStack } from "@/components/ui/Toast";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const resent = searchParams.get("resent") === "true";

  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || !email || sending) return;
    setSending(true);
    await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    setCooldown(30);
    pushToast({ label: "Confirmation email resent." });
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <ToastStack />
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "11px",
          borderTop: "2px solid var(--color-jade)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ color: "var(--color-gold)", fontSize: "1.5rem", fontWeight: 500, letterSpacing: "-0.01em", margin: "0 0 0.75rem" }}>
            TradeCore
          </h1>
          <p style={{ color: "var(--color-text-primary)", fontSize: "0.9375rem", fontWeight: 500, margin: "0 0 0.375rem" }}>
            Check your email
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", margin: 0, lineHeight: 1.6 }}>
            We sent a confirmation link to{" "}
            {email ? (
              <strong style={{ color: "var(--color-text-secondary)" }}>{email}</strong>
            ) : (
              "your email address"
            )}
            .
          </p>
        </div>

        {resent && (
          <div
            style={{
              background: "rgba(82, 163, 130, 0.1)",
              border: "1px solid rgba(82, 163, 130, 0.3)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              color: "var(--color-jade)",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            An account with this email already exists but hasn&apos;t been confirmed yet. We&apos;ve sent a new confirmation link.
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || sending || !email}
          style={{
            width: "100%",
            background: "#111C2E",
            border: "1px solid #1A2640",
            borderRadius: "8px",
            padding: "0.6875rem",
            color: cooldown > 0 || sending ? "rgba(107, 138, 170, 0.5)" : "#6B8AAA",
            fontSize: "0.9375rem",
            cursor: cooldown > 0 || sending || !email ? "not-allowed" : "pointer",
          }}
        >
          {sending
            ? "Sending…"
            : cooldown > 0
            ? `Resend available in ${cooldown}s`
            : "Resend confirmation email"}
        </button>

        <p style={{ color: "var(--color-text-secondary)", fontSize: "0.8125rem", marginTop: "1.25rem", lineHeight: 1.5 }}>
          Already confirmed?{" "}
          <Link href="/login" style={{ color: "var(--color-gold)", textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
