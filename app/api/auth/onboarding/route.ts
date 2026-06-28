import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminDb as db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  marketsTraded: z.array(z.string()).min(1, "Select at least one market"),
  broker: z.string().max(100).optional(),
  timezone: z.string().max(50),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { marketsTraded, broker, timezone } = parsed.data;

  // Update Neon users table
  await db
    .update(users)
    .set({
      marketsTraded,
      broker: broker ?? null,
      timezone,
      onboardingComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Mark complete in Supabase user_metadata so middleware doesn't DB-check on every request
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, onboarding_complete: true },
  });

  return NextResponse.json({ ok: true });
}
