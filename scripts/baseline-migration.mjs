/**
 * baseline-migration.mjs
 *
 * Marks the current 0000 baseline migration as already-applied in the
 * live database's drizzle.__drizzle_migrations table.  This is necessary
 * because the DB schema was applied via `drizzle-kit push` (not `migrate`),
 * so the migration journal is being re-baselined from scratch.
 *
 * Usage:
 *   node scripts/baseline-migration.mjs
 *
 * Requires DATABASE_URL or DATABASE_URL_DIRECT in .env / .env.local
 */

import { readFileSync } from "fs";
import { createHash } from "crypto";
import { neon } from "@neondatabase/serverless";

// ── Load env vars from .env.local / .env ─────────────────────────────
const envFiles = [".env.local", ".env"];
for (const f of envFiles) {
  try {
    const content = readFileSync(f, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // file not found, skip
  }
}

const connStr = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!connStr) {
  console.error("❌ Neither DATABASE_URL_DIRECT nor DATABASE_URL is set.");
  process.exit(1);
}

const sql = neon(connStr);

// ── Read the journal to get the folderMillis ─────────────────────────
const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf-8"));
const baselineEntry = journal.entries[0];
if (!baselineEntry) {
  console.error("❌ No entries found in _journal.json");
  process.exit(1);
}

// ── Read the baseline migration SQL and compute its hash ─────────────
const migrationSQL = readFileSync(
  `db/migrations/${baselineEntry.tag}.sql`,
  "utf-8"
);
// Drizzle-kit uses sha256 hex of the migration SQL content
const hash = createHash("sha256").update(migrationSQL).digest("hex");
const folderMillis = baselineEntry.when;

try {
  console.log("✓ Connecting to database...");

  // Drizzle-kit uses the "drizzle" schema for its migrations table
  await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;

  await sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // Check if this hash is already recorded
  const existing = await sql`
    SELECT id FROM "drizzle"."__drizzle_migrations" WHERE hash = ${hash}
  `;

  if (existing.length > 0) {
    console.log("⚠ Baseline migration already recorded — nothing to do.");
  } else {
    // Clear ALL old migration records — they reference the deleted migration files
    const deleted = await sql`
      DELETE FROM "drizzle"."__drizzle_migrations" RETURNING id
    `;
    if (deleted.length > 0) {
      console.log(`✓ Removed ${deleted.length} stale migration record(s) from drizzle schema`);
    }

    // Insert the baseline with created_at = folderMillis so drizzle-kit
    // recognises it as the "last applied" migration
    await sql`
      INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${folderMillis})
    `;
    console.log(`✓ Baseline migration ${baselineEntry.tag} marked as applied`);
    console.log(`  Hash: ${hash}`);
    console.log(`  folderMillis: ${folderMillis}`);
  }

  // Also clean up the accidental public-schema table if it exists
  try {
    await sql`DROP TABLE IF EXISTS "public"."__drizzle_migrations"`;
    console.log(`✓ Cleaned up stale public.__drizzle_migrations table`);
  } catch {
    // ignore
  }

  console.log("\n✅ Migration journal is now in sync with the live database.");
  console.log("   Future `drizzle-kit migrate` runs will start from here.");
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
