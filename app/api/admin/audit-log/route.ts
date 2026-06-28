import { type NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { requireAdmin, NotAuthenticatedError, NotAuthorizedError } from "@/lib/admin-auth";
import { adminDb as db } from "@/lib/db";
import { adminAuditLog } from "@/db/schema/admin_audit_log";
import { users } from "@/db/schema/users";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = (page - 1) * limit;

    const [rows, [{ totalCount }]] = await Promise.all([
      db
        .select({
          id:          adminAuditLog.id,
          adminUserId: adminAuditLog.adminUserId,
          adminEmail:  users.email,
          action:      adminAuditLog.action,
          targetType:  adminAuditLog.targetType,
          targetId:    adminAuditLog.targetId,
          details:     adminAuditLog.details,
          ipAddress:   adminAuditLog.ipAddress,
          createdAt:   adminAuditLog.createdAt,
        })
        .from(adminAuditLog)
        // LEFT JOIN — unauthorized_access_attempt rows reference non-admin users,
        // not absent ones, but this stays defensive either way.
        .leftJoin(users, eq(users.id, adminAuditLog.adminUserId))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ totalCount: count() }).from(adminAuditLog),
    ]);

    return NextResponse.json({
      entries: rows,
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
    console.error("[admin/audit-log] error:", err);
    return NextResponse.json({ error: "Something went wrong", code: "SERVER_ERROR" }, { status: 500 });
  }
}
