import { type NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

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

    // Generate a password recovery link — the admin never sees or sets the
    // user's actual password. The user receives an email to reset it themselves.
    const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: targetUser.email,
    });

    if (linkError) {
      console.error("[admin/send-password-reset] generateLink error:", linkError);
      return NextResponse.json(
        { error: "Failed to generate password reset link", code: "LINK_ERROR" },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminUserId: admin.id,
      action: "password_reset_sent",
      targetType: "user",
      targetId: targetUser.id,
      details: { email: targetUser.email },
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
    console.error("[admin/users/[id]/send-password-reset] error:", err);
    return NextResponse.json(
      { error: "Something went wrong", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
