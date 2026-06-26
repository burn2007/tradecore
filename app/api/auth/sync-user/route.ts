import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if Neon record exists
  const existing = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ user: existing[0], isNew: false });
  }

  // Create it
  const [created] = await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email!,
      displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      role: "user",
    })
    .returning();

  return NextResponse.json({ user: created, isNew: true });
}
