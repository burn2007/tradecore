import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAdmin, NotAuthenticatedError, NotAuthorizedError } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { logAdminAction } from "@/lib/audit-log";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const tierSchema = z.object({
  tier: z.enum(["free", "pro", "premium"]),
});

// SECURITY: never extend this endpoint to modify role. Role changes happen only via direct manual database access.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = tierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const [existing] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const [updated] = await db
      .update(users)
      .set({ tier: parsed.data.tier, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    await logAdminAction({
      adminUserId: admin.id,
      action:      "tier_change",
      targetType:  "user",
      targetId:    id,
      details:     { from: existing.tier, to: parsed.data.tier },
      request,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: "Not authenticated", code: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/users/[id]/tier] error:", err);
    return NextResponse.json({ error: "Something went wrong", code: "SERVER_ERROR" }, { status: 500 });
  }
}
