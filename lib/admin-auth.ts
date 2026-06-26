import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { logAdminAction } from "@/lib/audit-log";

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "NotAuthorizedError";
  }
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Throws NotAuthenticatedError if there's no signed-in user, or
 * NotAuthorizedError if the signed-in user isn't an admin (and records the
 * attempt). Role is always read fresh from Neon — never from a cached
 * value, JWT claim, or session property.
 *
 * Works with no `request` (Server Components) or with one (API routes,
 * so the attempt can be tied to a path and IP).
 */
export async function requireAdmin(request?: Request): Promise<AdminUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new NotAuthenticatedError();

  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (row?.role !== "admin") {
    await logAdminAction({
      adminUserId: user.id,
      action: "unauthorized_access_attempt",
      details: {
        attemptedPath: request ? new URL(request.url).pathname : "server component, no request",
      },
      request,
    });
    throw new NotAuthorizedError();
  }

  return { id: user.id, email: user.email!, role: "admin" };
}
