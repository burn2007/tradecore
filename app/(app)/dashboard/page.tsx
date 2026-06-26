import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = { title: "Dashboard — TradeCore" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  let firstName = "Trader";

  try {
    const [row] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (row?.displayName) {
      firstName = row.displayName.split(" ")[0];
    } else if (authUser.user_metadata?.full_name) {
      firstName = (authUser.user_metadata.full_name as string).split(" ")[0];
    } else if (authUser.email) {
      firstName = authUser.email.split("@")[0];
    }
  } catch {
    // DB temporarily unavailable — use default
  }

  return <DashboardClient firstName={firstName} />;
}
