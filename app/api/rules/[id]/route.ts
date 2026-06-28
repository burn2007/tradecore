import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withUserContext } from "@/lib/db";
import { rules } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive:    z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined)       updates.title       = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.isActive !== undefined)    updates.isActive    = parsed.data.isActive;
  if (parsed.data.sortOrder !== undefined)   updates.sortOrder   = parsed.data.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await withUserContext(user.id, async (tx) => {
    const [row] = await tx
      .update(rules)
      .set(updates)
      .where(and(eq(rules.id, id), eq(rules.userId, user.id)))
      .returning();
    return row ?? null;
  });

  if (!updated) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await withUserContext(user.id, async (tx) => {
    const [row] = await tx
      .delete(rules)
      .where(and(eq(rules.id, id), eq(rules.userId, user.id)))
      .returning();
    return row ?? null;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
