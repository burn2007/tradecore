import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { count, desc, eq, isNull } from "drizzle-orm";
import {
  requireAdmin,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { statsCache } from "@/db/schema/stats_cache";
import { trades } from "@/db/schema/trades";
import { logAdminAction } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ── GET /api/admin/users/[id] ─────────────────────────────────────────────────
// Returns soft-deleted users too (admins need to view them in the reserve),
// but includes deletedAt and deletedByEmail so the UI can show the right state.

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin(request);

    const { id } = await params;

    console.time(`[admin/users/${id.slice(0, 8)}] GET`);

    // Join deletedBy to resolve the deleting admin's email.
    const deletedByAlias = db
      .select({ id: users.id, email: users.email })
      .from(users)
      .as("deleter");

    const rows = await db
      .select({
        id:               users.id,
        email:            users.email,
        displayName:      users.displayName,
        avatarUrl:        users.avatarUrl,
        tier:             users.tier,
        role:             users.role,
        preferredCurrency:users.preferredCurrency,
        timezone:         users.timezone,
        stripeCustomerId: users.stripeCustomerId,
        onboardingComplete: users.onboardingComplete,
        marketsTraded:    users.marketsTraded,
        broker:           users.broker,
        deletedAt:        users.deletedAt,
        deletedBy:        users.deletedBy,
        createdAt:        users.createdAt,
        updatedAt:        users.updatedAt,
        deletedByEmail:   deletedByAlias.email,
      })
      .from(users)
      .leftJoin(deletedByAlias, eq(deletedByAlias.id, users.deletedBy))
      .where(eq(users.id, id))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const [statsRows, recentTrades] = await Promise.all([
      db.select().from(statsCache).where(eq(statsCache.userId, id)).limit(1),
      db
        .select({
          id:        trades.id,
          symbol:    trades.symbol,
          direction: trades.direction,
          pnlUsd:    trades.pnlUsd,
          entryAt:   trades.entryAt,
        })
        .from(trades)
        .where(eq(trades.userId, id))
        .orderBy(desc(trades.entryAt))
        .limit(10),
    ]);

    console.timeEnd(`[admin/users/${id.slice(0, 8)}] GET`);
    return NextResponse.json({
      user,
      stats: statsRows[0] ?? null,
      recentTrades,
    });
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: "Not authenticated", code: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/users/[id]] GET error:", err);
    return NextResponse.json({ error: "Something went wrong", code: "SERVER_ERROR" }, { status: 500 });
  }
}

// ── DELETE /api/admin/users/[id] — SOFT DELETE ────────────────────────────────
//
// This no longer permanently destroys data. Instead it:
//   1. Sets deleted_at + deleted_by on the Neon row.
//   2. Bans the user in Supabase Auth (ban_duration ~100 years).
//
// All four existing safeguards are preserved unchanged:
//   1. Target user must exist AND not already be soft-deleted.
//   2. Admin cannot soft-delete their own account.
//   3. Admin accounts cannot be soft-deleted through this panel — same policy
//      as the role-change restriction.
//   4. Caller must supply the target user's exact email (server-side confirmed).

const deleteBodySchema = z.object({
  confirmEmail: z.string(),
});

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    // ── Safeguard 1: target user must exist and be active ────────────────────
    const [targetUser] = await db
      .select({
        id:        users.id,
        email:     users.email,
        role:      users.role,
        tier:      users.tier,
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

    if (targetUser.deletedAt != null) {
      return NextResponse.json(
        { error: "This account is already in the reserve", code: "ALREADY_DELETED" },
        { status: 400 }
      );
    }

    // ── Safeguard 2: admin cannot soft-delete themselves ─────────────────────
    if (targetUser.id === admin.id) {
      return NextResponse.json(
        {
          error: "You cannot delete your own account through this panel",
          code:  "CANNOT_DELETE_SELF",
        },
        { status: 400 }
      );
    }

    // ── Safeguard 3: admin accounts cannot be soft-deleted through this panel ─
    // Admin account removal, like role changes, should only ever happen via
    // direct manual database access by a human.
    if (targetUser.role === "admin") {
      return NextResponse.json(
        {
          error: "Admin accounts cannot be deleted through this panel",
          code:  "CANNOT_DELETE_ADMIN",
        },
        { status: 400 }
      );
    }

    // ── Safeguard 4: caller must confirm the exact email address ─────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = deleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 422 }
      );
    }

    if (parsed.data.confirmEmail !== targetUser.email) {
      return NextResponse.json(
        {
          error: "Confirmation email does not match",
          code:  "CONFIRMATION_MISMATCH",
        },
        { status: 400 }
      );
    }

    // ── Fetch trade count for audit log ──────────────────────────────────────
    const [{ totalTrades }] = await db
      .select({ totalTrades: count() })
      .from(trades)
      .where(eq(trades.userId, id));

    // ── Audit log BEFORE the write ────────────────────────────────────────────
    await logAdminAction({
      adminUserId: admin.id,
      action:      "user_soft_deleted",
      targetType:  "user",
      targetId:    targetUser.id,
      details:     {
        email:       targetUser.email,
        tier:        targetUser.tier,
        totalTrades: Number(totalTrades),
      },
      request,
    });

    // ── Mark soft-deleted in Neon ─────────────────────────────────────────────
    await db
      .update(users)
      .set({ deletedAt: new Date(), deletedBy: admin.id, updatedAt: new Date() })
      .where(eq(users.id, targetUser.id));

    // ── Ban in Supabase Auth (~100 years, functioning as indefinite) ──────────
    // ban_duration keeps the auth identity intact so the account is fully
    // restorable. The user's session will be rejected by Supabase on next use,
    // and our proxy.ts gate will catch any still-valid sessions immediately.
    const supabaseAdmin = createAdminClient();
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { ban_duration: "876000h" }
    );
    if (banError) {
      console.error("[admin/users/[id]] updateUserById ban error:", banError);
      // Non-fatal for the Neon side — the row is already marked deleted.
      // Log and continue; the proxy gate will still block the user.
    }

    return NextResponse.json({ success: true, deletedUserId: id });
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
    console.error("[admin/users/[id]] DELETE error:", err);
    return NextResponse.json(
      { error: "Something went wrong", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
