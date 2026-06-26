import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { rules } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

const ruleSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  isActive:    z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
});

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await db
    .select()
    .from(rules)
    .where(eq(rules.userId, user.id))
    .orderBy(asc(rules.sortOrder), asc(rules.createdAt));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
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

  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { title, description, sortOrder } = parsed.data;

  const [rule] = await db
    .insert(rules)
    .values({
      userId:      user.id,
      title,
      description: description ?? null,
      sortOrder:   sortOrder ?? 0,
      isActive:    true,
    })
    .returning();

  return NextResponse.json(rule, { status: 201 });
}
