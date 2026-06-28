import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withUserContext } from "@/lib/db";
import { rules } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import RulesClient from "@/components/settings/RulesClient";

export const metadata: Metadata = {
  title: "Trading Rules — TradeCore",
  description: "Define and manage the trading rules you check after every trade.",
};

export default async function RulesPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const userRules = await withUserContext(authUser.id, (tx) =>
    tx.select()
      .from(rules)
      .where(eq(rules.userId, authUser.id))
      .orderBy(asc(rules.sortOrder), asc(rules.createdAt))
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <a
            href="/settings"
            style={{
              fontSize: 12,
              color: "#4B6080",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg viewBox="0 0 8 14" width="6" fill="none" stroke="#4B6080" strokeWidth="2" strokeLinecap="round">
              <path d="M7 1L1 7l6 6" />
            </svg>
            Settings
          </a>
          <span style={{ color: "#1A2640", fontSize: 12 }}>/</span>
          <span style={{ fontSize: 12, color: "#6B8AAA" }}>Trading Rules</span>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: "#C9C2AE", margin: "0 0 4px" }}>
          Trading Rules
        </h1>
        <p style={{ fontSize: 12, color: "#6B8AAA", margin: 0 }}>
          Rules you check after every trade to track compliance and discipline.
        </p>
      </div>

      <RulesClient initialRules={userRules} />
    </div>
  );
}
