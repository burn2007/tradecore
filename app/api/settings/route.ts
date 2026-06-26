import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const settingsSchema = z.object({
  displayName:       z.string().max(100).optional(),
  preferredCurrency: z.enum(["USD", "NGN", "GHS", "KES", "ZAR", "EUR", "GBP"]).optional(),
  timezone:          z.string().max(50).optional(),
  broker:            z.string().max(100).optional(),
  marketsTraded:     z.array(z.string().max(40)).optional(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { displayName, preferredCurrency, timezone, broker, marketsTraded } =
    parsed.data;

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (displayName !== undefined)       updates.displayName       = displayName;
  if (preferredCurrency !== undefined) updates.preferredCurrency = preferredCurrency;
  if (timezone !== undefined)          updates.timezone          = timezone;
  if (broker !== undefined)            updates.broker            = broker;
  if (marketsTraded !== undefined)     updates.marketsTraded     = marketsTraded;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json({
    displayName:       updated.displayName,
    preferredCurrency: updated.preferredCurrency,
    timezone:          updated.timezone,
    broker:            updated.broker,
    marketsTraded:     updated.marketsTraded,
  });
}
