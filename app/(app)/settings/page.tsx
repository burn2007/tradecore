import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withUserContext } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "@/components/settings/SettingsClient";

export const metadata: Metadata = {
  title: "Settings — TradeCore",
  description: "Manage your TradeCore account, currency preference and profile.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [neonUser = null] = await withUserContext(authUser.id, (tx) =>
    tx.select().from(users).where(eq(users.id, authUser.id)).limit(1)
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "#C9C2AE",
            margin: "0 0 4px",
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: 12, color: "#6B8AAA", margin: 0 }}>
          Manage your profile, currency display and trading preferences.
        </p>
      </div>

      <SettingsClient
        initialDisplayName={neonUser?.displayName ?? ""}
        initialCurrency={neonUser?.preferredCurrency ?? "USD"}
        initialTimezone={neonUser?.timezone ?? "UTC"}
        initialBroker={neonUser?.broker ?? ""}
        initialMarketsTraded={neonUser?.marketsTraded ?? []}
        email={authUser.email ?? ""}
        tier={neonUser?.tier ?? "free"}
      />
    </div>
  );
}
