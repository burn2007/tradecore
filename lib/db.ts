import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import ws from "ws";

// Pool uses WebSockets (not stateless HTTP), which is required for transaction
// support. ws is listed in serverExternalPackages so webpack does not bundle
// it — Node.js loads it from node_modules at runtime with full native support
// (bufferutil masking). Must be set before any Pool is created.
neonConfig.webSocketConstructor = ws;

// Restricted application role — use DATABASE_URL_APP in production once the
// `tradecore_app` role and RLS policies are created via scripts/migrate-rls.sql.
// Falls back to DATABASE_URL (owner connection) if not configured, which keeps
// development working and disables RLS enforcement (WHERE clauses still protect).
const appPool = new Pool({
  connectionString: process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL!,
});
export const db = drizzle(appPool, { schema });

// Owner connection — has BYPASSRLS and full privileges.
// Use for admin routes, auth flows, and system-level operations.
const ownerPool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const adminDb = drizzle(ownerPool, { schema });

type AppDb = NeonDatabase<typeof schema>;

// Wraps user-scoped queries in a transaction that sets app.current_user_id
// so Postgres RLS policies can enforce per-user row isolation.
// All queries inside fn() see only data belonging to userId.
export async function withUserContext<T>(
  userId: string,
  fn: (tx: AppDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // is_local=true: setting is transaction-scoped and auto-resets on
    // commit/rollback, so it cannot leak to the next request on a reused
    // connection from the pool.
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx as unknown as AppDb);
  });
}
