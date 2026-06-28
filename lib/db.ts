import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

// Next.js patches globalThis.fetch with a dedup/cache wrapper that breaks
// Neon's HTTP driver (UND_ERR_CONNECT_TIMEOUT). Next.js stores the real undici
// fetch on `globalThis.fetch._nextOriginalFetch` after patchFetch() runs.
//
// We use a lazy function (not a module-level snapshot) because lib/db.ts is
// imported before Next.js calls patchFetch(), so _nextOriginalFetch doesn't
// exist yet at module init time. The function resolves it fresh on every call.
neonConfig.fetchFunction = (url: RequestInfo | URL, init?: RequestInit) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realFetch = (globalThis.fetch as any)?._nextOriginalFetch ?? globalThis.fetch;
  return realFetch(url, init);
};

// Restricted application role — use DATABASE_URL_APP in production once the
// `tradecore_app` role and RLS policies are created via scripts/migrate-rls.sql.
// Falls back to DATABASE_URL (owner connection) if not configured, which keeps
// development working and disables RLS enforcement (WHERE clauses still protect).
const appSql = neon(process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL!);
export const db = drizzle(appSql, { schema });

// Owner connection — has BYPASSRLS and full privileges.
// Use for admin routes, auth flows, and system-level operations.
const ownerSql = neon(process.env.DATABASE_URL!);
export const adminDb = drizzle(ownerSql, { schema });

type AppDb = NeonHttpDatabase<typeof schema>;

// Wraps user-scoped queries in a transaction that sets app.current_user_id
// so Postgres RLS policies can enforce per-user row isolation.
// All queries inside fn() see only data belonging to userId.
export async function withUserContext<T>(
  userId: string,
  fn: (tx: AppDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, false)`);
    return fn(tx as unknown as AppDb);
  });
}
