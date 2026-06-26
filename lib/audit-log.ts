import { db } from "@/lib/db";
import { adminAuditLog } from "@/db/schema/admin_audit_log";

export interface LogAdminActionParams {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
 * Records an admin action (or unauthorized attempt) to admin_audit_log.
 * Never throws — a logging failure must never block the action that triggered it.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const { adminUserId, action, targetType, targetId, details, request } = params;

    let ipAddress: string | null = null;
    if (request) {
      const forwardedFor = request.headers.get("x-forwarded-for");
      ipAddress = forwardedFor
        ? forwardedFor.split(",")[0].trim()
        : request.headers.get("x-real-ip");
    }

    await db.insert(adminAuditLog).values({
      adminUserId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      details: details ?? null,
      ipAddress,
    });
  } catch (err) {
    console.error("[audit-log] failed to record admin action:", err);
  }
}
