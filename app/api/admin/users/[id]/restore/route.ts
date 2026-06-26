import { type NextRequest, NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import {
  requireAdmin,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { logAdminAction } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ── POST /api/admin/users/[id]/restore ────────────────────────────────────────
// Restores a soft-deleted account: clears deleted_at/deleted_by and lifts the
// Supabase Auth ban (ban_duration: 'none').

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    const [targetUser] = await db
      .select({
        id:        users.id,
        email:     users.email,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (targetUser.deletedAt == null) {
      return NextResponse.json(
        { error: "This account is not deleted", code: "NOT_DELETED" },
        { status: 400 }
      );
    }

    // ── Lift the Supabase Auth ban ────────────────────────────────────────────
    const supabaseAdmin = createAdminClient();
    const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { ban_duration: "none" }
    );
    if (unbanError) {
      console.error("[admin/users/[id]/restore] updateUserById unban error:", unbanError);
      return NextResponse.json(
        { error: "Failed to lift auth ban", code: "AUTH_UNBAN_ERROR" },
        { status: 500 }
      );
    }

    // ── Clear soft-delete fields in Neon ─────────────────────────────────────
    await db
      .update(users)
      .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
      .where(eq(users.id, targetUser.id));

    await logAdminAction({
      adminUserId: admin.id,
      action:      "user_restored",
      targetType:  "user",
      targetId:    targetUser.id,
      details:     { email: targetUser.email },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.json(
        { error: "Not authenticated", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[admin/users/[id]/restore] error:", err);
    return NextResponse.json(
      { error: "Something went wrong", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
