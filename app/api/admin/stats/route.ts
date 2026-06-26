import { type NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { requireAdmin, NotAuthenticatedError, NotAuthorizedError } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { trades } from "@/db/schema/trades";
import { adminAuditLog } from "@/db/schema/admin_audit_log";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.time("[admin/stats] all-queries");
    const [
      [{ totalUsers }],
      tierRows,
      [{ totalTrades }],
      [{ newSignups7d }],
      [{ unauthorizedAttempts7d }],
      [{ reserveCount }],
    ] = await Promise.all([
      db.select({ totalUsers: sql<number>`count(*)::int` }).from(users).where(isNull(users.deletedAt)),
      db.select({ tier: users.tier, tierCount: sql<number>`count(*)::int` }).from(users).where(isNull(users.deletedAt)).groupBy(users.tier),
      db.select({ totalTrades: sql<number>`count(*)::int` }).from(trades),
      db.select({ newSignups7d: sql<number>`count(*)::int` }).from(users).where(and(isNull(users.deletedAt), gte(users.createdAt, sevenDaysAgo))),
      db
        .select({ unauthorizedAttempts7d: sql<number>`count(*)::int` })
        .from(adminAuditLog)
        .where(
          and(
            eq(adminAuditLog.action, "unauthorized_access_attempt"),
            gte(adminAuditLog.createdAt, sevenDaysAgo),
          ),
        ),
      db.select({ reserveCount: sql<number>`count(*)::int` }).from(users).where(isNotNull(users.deletedAt)),
    ]);

    console.timeEnd("[admin/stats] all-queries");
    const usersByTier: Record<string, number> = { free: 0, pro: 0, premium: 0 };
    for (const row of tierRows) {
      if (row.tier in usersByTier) usersByTier[row.tier] = Number(row.tierCount);
    }

    return NextResponse.json({
      totalUsers: Number(totalUsers),
      usersByTier,
      totalTrades: Number(totalTrades),
      newSignups7d: Number(newSignups7d),
      unauthorizedAttempts7d: Number(unauthorizedAttempts7d),
      reserveCount: Number(reserveCount),
    });
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: "Not authenticated", code: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/stats] error:", err);
    return NextResponse.json({ error: "Something went wrong", code: "SERVER_ERROR" }, { status: 500 });
  }
}
