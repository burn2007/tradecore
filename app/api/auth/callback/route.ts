import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminDb as db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // Email confirmation link
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
    }
  }

  // Google OAuth / magic link code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
    }
  }

  // Get the now-authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_session`);
  }

  // Upsert Neon user record
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({
      id: user.id,
      email: user.email!,
      displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      role: "user",
    });
    // New user — go to onboarding
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // Returning user — admins go to choose-destination, regular users go to /dashboard
  const [returning] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const dest = returning?.role === "admin" ? "/choose-destination" : next;
  return NextResponse.redirect(`${origin}${dest}`);
}
