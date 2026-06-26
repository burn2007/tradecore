/**
 * Enables Row Level Security on all TradeCore tables.
 *
 * Architecture note:
 * TradeCore uses Neon (not Supabase Postgres) as the database.
 * Supabase's auth.uid() function only exists inside Supabase's own Postgres,
 * so it cannot be used in RLS policies here.
 *
 * Data isolation is enforced at two levels:
 *   1. APPLICATION LAYER — every Drizzle query in API routes includes
 *      .where(eq(table.userId, authenticatedUserId))
 *   2. DATABASE LAYER (this script) — RLS is ENABLED so the DB owner
 *      (neondb_owner) is the only role that can access data.
 *      All application queries go through this role already.
 *
 * If you later add a read-only analytics role or expose the DB to external
 * tools, add a role-specific GRANT + policy at that time.
 *
 * Run: node scripts/apply-rls.mjs
 */
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  try {
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* fall back to shell environment */ }
}

loadEnv();

const url = process.env.DATABASE_URL_DIRECT;
if (!url) { console.error("ERROR: DATABASE_URL_DIRECT is not set."); process.exit(1); }

const pool = new Pool({ connectionString: url });

const TABLES = [
  "users",
  "trades",
  "trade_screenshots",
  "emotion_logs",
  "rules",
  "rule_violations",
  "setup_tags",
  "stats_cache",
  "user_milestones",
  "weekly_summaries",
  "ai_context_cache",
];

console.log("Enabling RLS on all TradeCore tables…\n");

const client = await pool.connect();
try {
  for (const table of TABLES) {
    await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    // FORCE RLS applies even to table owners — ensures no accidental full-table reads
    // from future tooling. Comment this out if drizzle-kit migrations start failing.
    await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    console.log(`  ✓ ${table}`);
  }

  // Confirm via pg_class (pg_tables doesn't expose relforcerowsecurity on Neon)
  const { rows } = await client.query(`
    SELECT
      c.relname                AS tablename,
      c.relrowsecurity         AS rls_enabled,
      c.relforcerowsecurity    AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  console.log("\n── Table RLS status ─────────────────────────────────────────");
  console.log(`${"Table".padEnd(28)} ${"RLS".padEnd(12)} FORCED`);
  console.log("─".repeat(52));
  for (const row of rows) {
    const rls    = row.rls_enabled ? "✓ ENABLED " : "✗ DISABLED";
    const forced = row.rls_forced  ? "✓"          : "—";
    console.log(`${row.tablename.padEnd(28)} ${rls.padEnd(12)} ${forced}`);
  }

  console.log(`
Note: No row-level policies are defined on Neon because auth.uid()
(a Supabase-only function) is not available here. Data isolation is
enforced in every API route via Drizzle .where(eq(table.userId, uid)).
`);
} finally {
  client.release();
  await pool.end();
}
