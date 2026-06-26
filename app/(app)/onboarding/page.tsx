import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "@/components/onboarding/form";

export const metadata = { title: "Welcome to TradeCore" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Already completed — middleware should catch this, but guard here too
  if (user.user_metadata?.onboarding_complete === true) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "3rem 1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ color: "var(--color-gold)", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            WELCOME TO TRADECORE
          </p>
          <h1
            style={{
              color: "var(--color-text-primary)",
              fontSize: "1.75rem",
              fontWeight: 500,
              lineHeight: 1.2,
              margin: 0,
              marginBottom: "0.75rem",
            }}
          >
            Let&apos;s set up your journal
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6, margin: 0 }}>
            Takes 30 seconds. Helps TradeCore tailor your P&amp;L view and session insights.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "11px",
            borderTop: "2px solid var(--color-gold)",
            padding: "2rem",
          }}
        >
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
