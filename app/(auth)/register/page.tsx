"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName || null },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  async function handleGoogle() {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  if (success) {
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
            maxWidth: "400px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "11px",
            borderTop: "2px solid var(--color-jade)",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "var(--color-jade)", fontSize: "1.25rem", fontWeight: 500, marginBottom: "0.75rem" }}>
            Check your email
          </h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: "var(--color-text-primary)" }}>{email}</strong>.
            Click it to activate your account.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              color: "var(--color-gold)",
              textDecoration: "none",
              fontSize: "0.9375rem",
            }}
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
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
          maxWidth: "400px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "11px",
          borderTop: "2px solid var(--color-gold)",
          padding: "2rem",
        }}
      >
        {/* Brand */}
        <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
          <h1
            style={{
              color: "var(--color-gold)",
              fontSize: "1.5rem",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            TradeCore
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", marginTop: "0.375rem" }}>
            Create your free account
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: "rgba(240, 124, 124, 0.1)",
              border: "1px solid rgba(240, 124, 124, 0.3)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              color: "var(--color-rose)",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Display name (optional) */}
          <div>
            <label
              style={{
                display: "block",
                color: "var(--color-text-secondary)",
                fontSize: "0.8125rem",
                marginBottom: "0.375rem",
              }}
            >
              Display name{" "}
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              placeholder="Trader Joe"
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

          {/* Email */}
          <div>
            <label
              style={{
                display: "block",
                color: "var(--color-text-secondary)",
                fontSize: "0.8125rem",
                marginBottom: "0.375rem",
              }}
            >
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

          {/* Password */}
          <div>
            <label
              style={{
                display: "block",
                color: "var(--color-text-secondary)",
                fontSize: "0.8125rem",
                marginBottom: "0.375rem",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                style={{
                  width: "100%",
                  background: "var(--color-deep)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "0.625rem 2.5rem 0.625rem 0.875rem",
                  color: "var(--color-text-primary)",
                  fontSize: "0.9375rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label
              style={{
                display: "block",
                color: "var(--color-text-secondary)",
                fontSize: "0.8125rem",
                marginBottom: "0.375rem",
              }}
            >
              Confirm password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                style={{
                  width: "100%",
                  background: "var(--color-deep)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "0.625rem 2.5rem 0.625rem 0.875rem",
                  color: "var(--color-text-primary)",
                  fontSize: "0.9375rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

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
              padding: "0.6875rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--color-border)" }} />
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "var(--color-border)" }} />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "0.6875rem",
            color: "var(--color-text-primary)",
            fontSize: "0.9375rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.625rem",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Login link */}
        <p
          style={{
            textAlign: "center",
            color: "var(--color-text-secondary)",
            fontSize: "0.875rem",
            marginTop: "1.5rem",
          }}
        >
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-gold)", textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
