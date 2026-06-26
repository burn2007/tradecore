// DANGER: this client bypasses all Supabase Auth restrictions. Only ever import
// this inside admin API routes that have already called requireAdmin(). Never
// import this in any client component or any non-admin route.
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin client — uses the SERVICE ROLE key.
 *
 * This client has full access to all Supabase auth admin methods:
 * auth.admin.createUser(), auth.admin.deleteUser(),
 * auth.admin.updateUserById(), auth.admin.generateLink(), etc.
 *
 * It bypasses RLS and all user-level auth restrictions.
 * NEVER import this in browser/client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
