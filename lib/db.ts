import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

// Next.js patches globalThis.fetch with a dedup/cache wrapper that breaks
// Neon's HTTP driver (UND_ERR_CONNECT_TIMEOUT). We resolve the real undici
// fetch lazily on each call because lib/db.ts is imported before Next.js
// calls patchFetch(), so _nextOriginalFetch doesn't exist yet at module init.
neonConfig.fetchFunction = (url: RequestInfo | URL, init?: RequestInit) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realFetch = (globalThis.fetch as any)?._nextOriginalFetch ?? globalThis.fetch;
  return realFetch(url, init);
};

// Restricted application role — use DATABASE_URL_APP in production.
// Falls back to DATABASE_URL (owner connection) if not configured, which keeps
// development working (WHERE clauses still protect data isolation).
const appSql = neon(process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL!);
export const db = drizzle(appSql, { schema });

// Owner connection — has BYPASSRLS and full privileges.
// Use for admin routes, auth flows, and system-level operations.
const ownerSql = neon(process.env.DATABASE_URL!);
export const adminDb = drizzle(ownerSql, { schema });

type AppDb = NeonHttpDatabase<typeof schema>;

// Passthrough wrapper kept for call-site compatibility. The neon-http driver
// does not support stateful transactions, so set_config session variables
// cannot be used here. Data isolation is enforced by explicit WHERE user_id
// clauses in every query — confirmed correct by security audit.
export async function withUserContext<T>(
  _userId: string,
  fn: (db: AppDb) => Promise<T>,
): Promise<T> {
  return fn(db);
}
