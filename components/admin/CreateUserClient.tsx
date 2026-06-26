"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { pushToast } from "@/components/ui/Toast";

const TIER_COLOR: Record<string, string> = { free: "#4B6080", pro: "#50E3B8", premium: "#E2B96F" };
const TIER_BG:    Record<string, string> = { free: "#0A0F1A", pro: "#0D2420", premium: "#1A1A08" };

const INPUT_STYLE: React.CSSProperties = {
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

interface CreateUserResponse {
  id: string;
  email: string;
  tier: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

export default function CreateUserClient() {
  const router   = useRouter();
  const pathname = usePathname();
  const base     = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;

  const [email, setEmail]             = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tier, setTier]               = useState<"free" | "pro" | "premium">("free");
  const [emailError, setEmailError]   = useState<string | null>(null);

  const mutation = useMutation<CreateUserResponse, ApiErrorBody>({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:       email.trim(),
          displayName: displayName.trim() || undefined,
          tier,
        }),
      });
      const json: CreateUserResponse & ApiErrorBody = await res.json();
      if (!res.ok) throw json as ApiErrorBody;
      return json as CreateUserResponse;
    },
    onSuccess: (result) => {
      pushToast({
        label: `Account created. A password setup email has been sent to ${result.email}.`,
        accent: "#50E3B8",
      });
      router.push(`${base}/users/${result.id}`);
    },
    onError: (err) => {
      if (err.code === "EMAIL_EXISTS") {
        setEmailError(err.error ?? "A user with this email already exists.");
      } else {
        pushToast({
          label: err.error ?? "Something went wrong. Please try again.",
          accent: "#F07C7C",
        });
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim()) return;
    mutation.mutate();
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => router.push(`${base}/users`)}
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: 11, color: "#6B8AAA", cursor: "pointer",
            fontFamily: "inherit", textDecoration: "none",
          }}
        >
          ← Users
        </button>
        <p style={{ fontSize: 16, fontWeight: 500, color: "#C9C2AE", margin: 0 }}>Create user</p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#111C2E", border: "1px solid #1A2640",
          borderRadius: 11, padding: "20px 16px",
        }}
      >
        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: "#6B8AAA", display: "block", marginBottom: 6 }}>
            Email address <span style={{ color: "#F07C7C" }}>*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
            placeholder="user@example.com"
            style={{
              ...INPUT_STYLE,
              borderColor: emailError ? "#6A2828" : "#1A2640",
            }}
          />
          {emailError && (
            <p style={{ fontSize: 10, color: "#F07C7C", margin: "4px 0 0" }}>{emailError}</p>
          )}
        </div>

        {/* Display name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, color: "#6B8AAA", display: "block", marginBottom: 6 }}>
            Display name <span style={{ color: "#2E4060" }}>(optional)</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Kemi Adeyemi"
            style={INPUT_STYLE}
          />
        </div>

        {/* Tier selector — reuses exact same pattern as UserDetailClient */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: "#6B8AAA", margin: "0 0 8px" }}>Tier</p>
          <div style={{ display: "flex", gap: 6 }}>
            {(["free", "pro", "premium"] as const).map((t) => {
              const selected = tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8, fontSize: 12,
                    fontWeight: selected ? 500 : 400, textTransform: "capitalize",
                    cursor: "pointer", fontFamily: "inherit",
                    backgroundColor: selected ? TIER_BG[t] : "#0A0F1A",
                    border: `1px solid ${selected ? TIER_COLOR[t] : "#1A2640"}`,
                    color: selected ? TIER_COLOR[t] : "#4B6080",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: 10, color: "#2E4060", margin: "0 0 14px" }}>
          The user will receive an email to set their own password. No password is set by the admin.
        </p>

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending || !email.trim()}
          style={{
            width: "100%", height: 42, borderRadius: 8,
            backgroundColor: mutation.isPending || !email.trim() ? "#3A2E10" : "#E2B96F",
            border: "none",
            color: mutation.isPending || !email.trim() ? "#6B5020" : "#0A0F1A",
            fontSize: 13, fontWeight: 500, fontFamily: "inherit",
            cursor: mutation.isPending || !email.trim() ? "default" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {mutation.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
