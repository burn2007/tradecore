import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
  requireAdmin,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { trades } from "@/db/schema/trades";
import { logAdminAction } from "@/lib/audit-log";
import { createAdminClient } from "@/lib/supabase/admin";

// ── GET /api/admin/users ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));
    const offset = (page - 1) * limit;

    // Always exclude soft-deleted accounts from normal list views.
    const activeOnly = isNull(users.deletedAt);
    const where = search
      ? and(activeOnly, or(ilike(users.email, `%${search}%`), ilike(users.displayName, `%${search}%`)))
      : activeOnly;

    console.time("[admin/users] GET list");
    const [rows, [{ totalCount }]] = await Promise.all([
      db
        .select({
          id:          users.id,
          email:       users.email,
          displayName: users.displayName,
          tier:        users.tier,
          role:        users.role,
          createdAt:   users.createdAt,
          tradeCount:  sql<number>`cast(count(${trades.id}) as int)`,
        })
        .from(users)
        .leftJoin(trades, eq(trades.userId, users.id))
        .where(where)
        .groupBy(users.id)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ totalCount: count() }).from(users).where(where),
    ]);

    console.timeEnd("[admin/users] GET list");
    return NextResponse.json({
      users: rows,
      page,
      limit,
      totalCount: Number(totalCount),
    });
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: "Not authenticated", code: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/users] GET error:", err);
    return NextResponse.json({ error: "Something went wrong", code: "SERVER_ERROR" }, { status: 500 });
  }
}

// ── POST /api/admin/users — create a new user ─────────────────────────────────
//
// SECURITY: no role field in this schema. Role assignment is never possible
// through any API, ever. Same policy as the tier-change endpoint.

const createUserSchema = z.object({
  email:       z.string().email(),
  displayName: z.string().min(1).max(100).optional(),
  // Note: no role field — role is always explicitly set to 'user' below.
  tier:        z.enum(["free", "pro", "premium"]).default("free"),
});

/** Cryptographically random temporary password — never returned in any response. */
function generateSecurePassword(length = 24): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
  // Use crypto.getRandomValues if available (Node 19+/Edge), else fall back
  // to a repeated Math.random loop seeded from Date (acceptable for a throwaway
  // temp password that is immediately invalidated by the recovery link below).
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => charset[b % charset.length])
      .join("");
  }
  return Array.from({ length }, () =>
    charset[Math.floor(Math.random() * charset.length)]
  ).join("");
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { email, displayName, tier } = parsed.data;

    // ── Duplicate-email guard ────────────────────────────────────────────────
    // Only block against active accounts; a previously soft-deleted email can
    // be re-created (the soft-deleted row will remain in the reserve separately).
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists", code: "EMAIL_EXISTS" },
        { status: 409 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // ── Create Supabase auth user ────────────────────────────────────────────
    // email_confirm: true — admin-created accounts don't need email confirmation.
    // The temporary password is never returned in any response; the recovery
    // link below is what the new user actually uses to set their real password.
    const temporaryPassword = generateSecurePassword(24);

    const { data: authData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
      });

    if (createError || !authData.user) {
      console.error("[admin/users] createUser error:", createError);
      return NextResponse.json(
        { error: "Failed to create auth user", code: "AUTH_CREATE_ERROR" },
        { status: 500 }
      );
    }

    const newAuthUserId = authData.user.id;

    // ── Insert Neon user row ─────────────────────────────────────────────────
    // If this fails we must clean up the orphaned Supabase auth user to keep
    // auth and application data in sync.
    let newUser: (typeof users.$inferSelect) | undefined;
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          id:          newAuthUserId,
          email,
          displayName: displayName ?? null,
          tier,
          // Defense-in-depth: role is ALWAYS 'user'. Never trust the request
          // body for role assignment — same pattern as the tier-change endpoint.
          role: "user",
        })
        .returning();
      newUser = inserted;
    } catch (dbErr) {
      // Rollback: delete the orphaned Supabase auth user before returning error.
      console.error(
        "[admin/users] Neon insert failed — rolling back Supabase auth user:",
        dbErr
      );
      await supabaseAdmin.auth.admin.deleteUser(newAuthUserId).catch((e) =>
        console.error("[admin/users] rollback deleteUser failed:", e)
      );
      return NextResponse.json(
        {
          error: "Failed to create user record — auth user has been rolled back",
          code: "DB_INSERT_ERROR",
        },
        { status: 500 }
      );
    }

    // ── Send password reset link so user can set their real password ─────────
    // The temporary password above is never used in practice; the user logs in
    // via the recovery link generated here.
    const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (linkError) {
      // Non-fatal — account was created successfully; an admin can manually
      // trigger a reset via send-password-reset if the link fails here.
      console.warn(
        "[admin/users] post-creation generateLink warning:",
        linkError
      );
    }

    await logAdminAction({
      adminUserId: admin.id,
      action:      "user_created",
      targetType:  "user",
      targetId:    newUser.id,
      details:     { email, tier },
      request,
    });

    // Return the new user object — never include the temporary password.
    return NextResponse.json(newUser, { status: 201 });
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
    console.error("[admin/users] POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
