import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
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

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
