import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Shell from "@/components/layout/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const [neonUser = null] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  // Secondary soft-delete guard — proxy.ts is the primary gate, but this
  // layout runs after the middleware rewrite and provides defense-in-depth.
  // If deleted_at is set, the user should already have been redirected by
  // proxy.ts, but we check again here to ensure no path is left unguarded.
  if (neonUser?.deletedAt != null) {
    await supabase.auth.signOut();
    redirect("/deactivated");
  }

  return <Shell user={neonUser}>{children}</Shell>;
}
