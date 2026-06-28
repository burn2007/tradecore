import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withUserContext } from "@/lib/db";
import { setupTags } from "@/db/schema/setup_tags";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import type { SetupTag } from "@/db/schema/setup_tags";
import JournalClient from "@/components/trades/JournalClient";

export const metadata: Metadata = { title: "Journal — TradeCore" };

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let userTags: SetupTag[] = [];
  try {
    userTags = await withUserContext(user.id, (tx) =>
      tx.select().from(setupTags).where(eq(setupTags.userId, user.id))
    );
  } catch {
    // DB unavailable — render with empty tags
  }

  return <JournalClient setupTags={userTags} userId={user.id} />;
}
