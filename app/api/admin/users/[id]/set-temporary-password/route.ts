// This bypasses the user's control over their own password. Use
// send-password-reset instead whenever possible. This exists only for support
// cases where the user has no email access.
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
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

const bodySchema = z.object({
  temporaryPassword: z.string().min(8),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: parsed.data.temporaryPassword,
      });

    if (updateError) {
      console.error(
        "[admin/set-temporary-password] updateUserById error:",
        updateError
      );
      return NextResponse.json(
        { error: "Failed to set temporary password", code: "UPDATE_ERROR" },
        { status: 500 }
      );
    }

    // Deliberately do NOT log the actual password value in details, ever.
    await logAdminAction({
      adminUserId: admin.id,
      action: "temporary_password_set",
      targetType: "user",
      targetId: targetUser.id,
      details: { setBy: admin.email },
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
    console.error("[admin/users/[id]/set-temporary-password] error:", err);
    return NextResponse.json(
      { error: "Something went wrong", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
