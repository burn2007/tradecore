import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { count, eq, isNotNull } from "drizzle-orm";
import {
  requireAdmin,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/admin-auth";
import { adminDb as db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { trades } from "@/db/schema/trades";
import { logAdminAction } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  confirmEmail: z.string(),
});

// ── POST /api/admin/users/[id]/permanent-delete ───────────────────────────────
//
// Real, unrecoverable wipe. Only reachable via the reserve (account MUST
// already be soft-deleted — there is no direct path from active → permanent).
//
// Safeguards in order:
//   1. Account must have a non-null deleted_at (NOT_IN_RESERVE if active).
//   2. Self-delete and admin-delete checks — defense in depth.
//   3. Caller must provide exact email confirmation, verified server-side.
//
// Execution order:
//   A. Log BEFORE any deletion (captures everything that will be lost).
//   B. Delete Supabase auth identity.
//   C. Delete Neon user row (cascade handles all child tables).

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    // ── Safeguard 1: must already be soft-deleted ─────────────────────────────
    const [targetUser] = await db
      .select({
        id:        users.id,
        email:     users.email,
        role:      users.role,
        tier:      users.tier,
        deletedAt: users.deletedAt,
        deletedBy: users.deletedBy,
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
        {
          error: "Account must be soft-deleted before it can be permanently wiped",
          code:  "NOT_IN_RESERVE",
        },
        { status: 400 }
      );
    }

    // ── Safeguard 2: self-delete and admin-delete guards (defense in depth) ───
    // These should be unreachable since active accounts are blocked above, but
    // we check anyway — matching the same policy as the soft-delete endpoint.
    if (targetUser.id === admin.id) {
      return NextResponse.json(
        {
          error: "You cannot delete your own account through this panel",
          code:  "CANNOT_DELETE_SELF",
        },
        { status: 400 }
      );
    }

    if (targetUser.role === "admin") {
      return NextResponse.json(
        {
          error: "Admin accounts cannot be deleted through this panel",
          code:  "CANNOT_DELETE_ADMIN",
        },
        { status: 400 }
      );
    }

    // ── Safeguard 3: exact email confirmation, server-side ────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    if (parsed.data.confirmEmail !== targetUser.email) {
      return NextResponse.json(
        { error: "Confirmation email does not match", code: "CONFIRMATION_MISMATCH" },
        { status: 400 }
      );
    }

    // ── Fetch trade count before deletion (for audit log) ────────────────────
    const [{ totalTrades }] = await db
      .select({ totalTrades: count() })
      .from(trades)
      .where(eq(trades.userId, id));

    // ── A. Audit log BEFORE any deletion ─────────────────────────────────────
    // Capture everything we'll lose, including who originally soft-deleted them
    // and when — after this step the row will be gone forever.
    await logAdminAction({
      adminUserId: admin.id,
      action:      "user_permanently_deleted",
      targetType:  "user",
      targetId:    targetUser.id,
      details:     {
        email:                targetUser.email,
        tier:                 targetUser.tier,
        totalTrades:          Number(totalTrades),
        originallyDeletedAt:  targetUser.deletedAt?.toISOString() ?? null,
        originallyDeletedBy:  targetUser.deletedBy ?? null,
      },
      request,
    });

    const supabaseAdmin = createAdminClient();

    // ── B. Delete Supabase auth identity ─────────────────────────────────────
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(targetUser.id);

    if (authDeleteError) {
      console.error(
        "[admin/users/[id]/permanent-delete] deleteUser (Supabase) error:",
        authDeleteError
      );
      return NextResponse.json(
        { error: "Failed to delete auth identity", code: "AUTH_DELETE_ERROR" },
        { status: 500 }
      );
    }

    // ── C. Delete Neon user row ───────────────────────────────────────────────
    // All child tables (trades, rules, rule_violations, emotion_logs,
    // trade_screenshots, setup_tags, stats_cache, user_milestones,
    // weekly_summaries, ai_context_cache) have onDelete: "cascade" on their
    // user_id FK — verified from schema files. No explicit child deletes needed.
    await db.delete(users).where(eq(users.id, targetUser.id));

    return NextResponse.json({ success: true, permanentlyDeletedUserId: id });
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
    console.error("[admin/users/[id]/permanent-delete] error:", err);
    return NextResponse.json(
      { error: "Something went wrong", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
