import { type NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import {
  requireAdmin,
  NotAuthenticatedError,
  NotAuthorizedError,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { trades } from "@/db/schema/trades";

// ── GET /api/admin/users/reserve ──────────────────────────────────────────────
// Returns soft-deleted accounts (WHERE deleted_at IS NOT NULL).
// Includes deleted_at and the deleting admin's email (resolved via LEFT JOIN).

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));
    const offset = (page - 1) * limit;

    const deletedOnly = isNotNull(users.deletedAt);
    const where = search
      ? and(deletedOnly, or(ilike(users.email, `%${search}%`), ilike(users.displayName, `%${search}%`)))
      : deletedOnly;

    // Self-join to resolve deletedBy → admin email.
    const deleterAlias = db
      .select({ id: users.id, email: users.email })
      .from(users)
      .as("deleter");

    const [rows, [{ totalCount }]] = await Promise.all([
      db
        .select({
          id:             users.id,
          email:          users.email,
          displayName:    users.displayName,
          tier:           users.tier,
          role:           users.role,
          deletedAt:      users.deletedAt,
          deletedBy:      users.deletedBy,
          deletedByEmail: deleterAlias.email,
          createdAt:      users.createdAt,
          tradeCount:     sql<number>`cast(count(${trades.id}) as int)`,
        })
        .from(users)
        .leftJoin(trades, eq(trades.userId, users.id))
        .leftJoin(deleterAlias, eq(deleterAlias.id, users.deletedBy))
        .where(where)
        .groupBy(users.id, deleterAlias.email)
        .orderBy(desc(users.deletedAt))
        .limit(limit)
        .offset(offset),
      db.select({ totalCount: count() }).from(users).where(where),
    ]);

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
    console.error("[admin/users/reserve] GET error:", err);
    return NextResponse.json({ error: "Something went wrong", code: "SERVER_ERROR" }, { status: 500 });
  }
}
