import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account Deactivated — TradeCore" };

export default function DeactivatedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-dm-sans, sans-serif)",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          backgroundColor: "#111C2E",
          border: "1px solid #1A2640",
          borderTop: "2px solid #F07C7C",
          borderRadius: 11,
          padding: "36px 32px",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#F07C7C", margin: "0 0 16px" }}>
          Account deactivated
        </p>
        <p style={{ fontSize: 15, fontWeight: 500, color: "#C9C2AE", margin: "0 0 10px" }}>
          Your account has been deactivated
        </p>
        <p style={{ fontSize: 12, color: "#6B8AAA", margin: "0 0 24px", lineHeight: 1.6 }}>
          Access to TradeCore has been suspended. If you believe this is a mistake,
          please contact support.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            fontSize: 12,
            color: "#6B8AAA",
            textDecoration: "underline",
          }}
        >
          Back to login
        </a>
      </div>
    </div>
  );
}
