"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--color-deep)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    padding: "0.625rem 2.5rem 0.625rem 0.875rem",
    color: "var(--color-text-primary)",
    fontSize: "0.9375rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const toggleStyle: React.CSSProperties = {
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
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "11px",
          borderTop: success ? "2px solid var(--color-jade)" : "2px solid var(--color-gold)",
          padding: "2rem",
        }}
      >
        <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
          <h1 style={{ color: "var(--color-gold)", fontSize: "1.5rem", fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>
            TradeCore
          </h1>
          <p style={{ color: "var(--color-text-primary)", fontSize: "0.9375rem", fontWeight: 500, marginTop: "0.5rem", marginBottom: 0 }}>
            {success ? "Password updated" : "Set new password"}
          </p>
        </div>

        {success ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", textAlign: "center", lineHeight: 1.6 }}>
            Your password has been updated. Redirecting to sign in…
          </p>
        ) : (
          <>
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
              <div>
                <label style={{ display: "block", color: "var(--color-text-secondary)", fontSize: "0.8125rem", marginBottom: "0.375rem" }}>
                  New password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={toggleStyle}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", color: "var(--color-text-secondary)", fontSize: "0.8125rem", marginBottom: "0.375rem" }}>
                  Confirm new password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={toggleStyle}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p style={{ color: "var(--color-rose)", fontSize: "0.75rem", marginTop: "0.375rem" }}>
                    Passwords do not match.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !passwordsMatch}
                style={{
                  width: "100%",
                  background: !passwordsMatch || loading ? "rgba(226, 185, 111, 0.5)" : "var(--color-gold)",
                  color: "#0a0f1a",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.6875rem",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  cursor: !passwordsMatch || loading ? "not-allowed" : "pointer",
                  marginTop: "0.25rem",
                }}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
