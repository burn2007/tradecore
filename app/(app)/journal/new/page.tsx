import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { rules } from "@/db/schema/rules";
import { setupTags } from "@/db/schema/setup_tags";
import { eq, and } from "drizzle-orm";
import TradeForm from "@/components/trades/TradeForm";
import type { Metadata } from "next";
import type { Rule } from "@/db/schema/rules";
import type { SetupTag } from "@/db/schema/setup_tags";

export const metadata: Metadata = { title: "Log Trade — TradeCore" };

export default async function NewTradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let userRules: Rule[] = [];
  let userTags: SetupTag[] = [];

  try {
    [userRules, userTags] = await Promise.all([
      db.select().from(rules).where(and(eq(rules.userId, user.id), eq(rules.isActive, true))),
      db.select().from(setupTags).where(eq(setupTags.userId, user.id)),
    ]);
  } catch {
    // DB unavailable or tables not yet migrated — render with empty defaults
  }

  return <TradeForm rules={userRules} setupTags={userTags} />;
}
